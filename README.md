# hapi-brakes

Plugin to simplify the circuit breaker system inside an Hapi.js environment

## Settings

When registering the plugin, you can give custom settings or using the default values :

### Default values

this settings that will be the default value for each circuitBreaker :

| Variable            | Type     | Default Value                                       | Documentation                                                                                                                     |
|---------------------|----------|-----------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------|
| **name**            | String   | `defaultBrake`                                      | hystrix command name, must be unique for each circuit within the same group.                                                      |
| group               | String   | `defaultBrakeGroup`                                 | Hystrix command group, used to group different command                                                                            |
| timeout             | Number   | `15000`                                             | Time in ms before a service call will timeout                                                                                     |
| threshold           | Float    | `0.5`                                               | % threshold for successful calls. If the % of successful calls dips below this threshold the circuit will break                   |
| waitThreshold       | Number   | `100`                                               | Number of requests to wait before testing circuit health                                                                          |
| statInterval        | Number   | `1200`                                              | Interval in ms that brakes should emit a snapshot event                                                                           |
| healthCheckInterval | Number   | `5000`                                              | Time in ms interval between each execution of health check function                                                               |
| bucketSpan          | Number   | `1000`                                              | Time in ms that a specific bucket should remain active                                                                            |
| bucketNum           | Number   | `60`                                                | Number of buckets to retain in a rolling window                                                                                   |
| percentiles         | Number[] | `[0.0, 0.25, 0.5, 0.75, 0.9, 0.95, 0.99, 0.995, 1]` | Array that defines the percentile levels that should be calculated on the stats object (i.e. 0.9 for 90th percentile)             |
| circuitDuration     | Number   | `30000`                                             | Time in ms that a circuit should remain broken                                                                                    |
| isFailure           | Function | `null`                                              | Function used to determine if the function failed or not, must return a Boolean.                                                  |
| healthCheck         | Function | `null`                                              | Function used to determine if the service is now available, must return a Promise.                                                |
| fallback            | Function | `null`                                              | Function executed if the service failed to deliver data, must return a Promise.                                                   |
| isPromise           | Boolean  | `false`                                             | to opt out of check for callback in function. This affects the passed in function, health check and fallback                      |
| isFunction          | Boolean  | `false`                                             | to opt out of check for callback, always promisifying in function. This affects the passed in function, health check and fallback |

Since it's a wrapper you can set the config as described in [Brakes documentation](https://github.com/awolden/brakes)

PS : i haven't tried the `isPromise` and `isFunction` option yet

### Hystrix Route

You can enable/disable the Hystrix SSE Endpoint by setting the `hystrixRoute` when registering the plugin. 
It's a basic Hapi endpoint (see [Hapi route documentation](http://hapijs.com/tutorials/routing)).

By passing `hystrixRoute` as `false` you'll disable the Hystrix route.

The default value is :

```javascript
hystrixRoute : {
    method : 'GET',
    path   : '/hystrix',
    config : {
        tags : [ 'api', 'hystrix' ],
    }
}
```

Warning, if you are changing this value, keep in mind that i'll override your `method` value to `GET` and the `handler` 
or the Hystrix Dashboard will not recognize the SSE stream.

### Example of config

```javascript
config = {
    name : 'test',
    group : 'groupTest',
    timeout : 150000, // some people like waiting a long time
    threshold : 1 // if one calls fail, it will open the circuit
    hystrixRoute : {
        method : 'GET',
        path   : '/hystrix',
        config : {
            tags : [ 'someOtherFunnyTag' ]
            // other config's endpoint
        }
    }
}
```

## Usage

The plugin will decorate `Server` with a `circuitBreaker` object that contains a `wrap` function and a `circuits` object.

`wrap` will return the `Circuit` object and add it to the `server.circuitBreaker.circuits` listing.

```javascript
server.circuitBreaker = { 
    wrap: [Function],
    circuits: { 
        'The name of the group': { 
            'The name of the first circuit breaker': [Circuit],
            'The name of the second circuit breaker': [Circuit]
        } 
    } 
}
```

Reusing `wrap` with the same name and group as an other circuit will override the first one.

### Examples

Wrapping a function inside a Circuit : 

```javascript
var circuit = server.circuitBreaker.wrap({
    name      : 'CircuitBreakerName', // Required
    group     : 'CircuitBreakerGroup', 
    timeout   : 2000, // 2s of timeout accepted
    threshold : 0.66, // if percentage of failed request is above 34%, it opens the circuit ( 1 - 0.66 = 0.34 ) 
    run       : (data) => { // the argument will be passed from the execution of the command ( see .exec() )
        return new Promise((fulfill, reject) => {
            request(data, (err, result) => {
                if (err || result.statusCode != 200) {
                    reject(err);
                    return;
                }
                fulfill(result);
            });
        });
    },
    isFailure : (err) => {
        // Do something to verify the error and decide to open or not the circuit
        // if the timeout is above the limit defined, the isFailure isn't called
        return true; // open it everytime
    },
    healthCheck : () => {
        return new Promise((fulfill, reject) => {
            // Do something to verify that the circuit could be closed
        }
    },
    fallback  : () => {
        return new Promise((resolve) => {
            resolve( 'something you want when the circuit is open, like asking a cache or something like that' );
        });
    }
});
```

Executing the function inside the circuit :

```javascript
circuit.exec({
   uri  : 'http://0.0.0.0:' + '8080' + '/users/' + 5,  // params sent to the run method
   json : true,
   time : true
}).then((data) => {
   // Data came before timeout limit (but it could be fallback data !)
}).catch((err) => {
   // something happens
});
```

You can use the `server.circuitBreaker.circuits` to get the Circuit object :

```javascript
server.circuitBreaker.circuits.CircuitBreakerGroup.CircuitBreakerName.exec({
    uri  : 'http://0.0.0.0:' + '8080' + '/users/' + 6, 
    json : true,
    time : true
}).then((data) => {
   // Data came before timeout limit (but it could be fallback data !)
}).catch((err) => {
   // something happens
});
```