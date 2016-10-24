'use strict';

const Brakes      = require('brakes');
const _           = require('underscore');
const globalStats = Brakes.getGlobalStats();

const CircuitBreaker = {
    _server : {},

    _settings : {
        hystrixRoute  : {
            method : 'GET',
            path   : '/api/hystrix.stream',
            config : {
                tags : ['api', 'hystrix'],
            }
        },
        timeout       : 400,
        threshold     : 0.6,
        statInterval  : 5000,
        waitThreshold : 20
    },

    /**
     * Wrap a request to another service within a CircuitBreaker command.
     *
     * @param       {object}            params                   Function's params.
     * @param       {string}            params.name              hystrix command name, must be unique.
     * @param       {string}            params.group             hystrix command group, used to group different command.
     * @param       {function}          params.run               Wrapped function executed, must return a Promise.
     * @param       {function}          params.errorHandler      Function used to determine if the function failed or not, must return a Boolean.
     * @param       {function}          params.healthCheck       Function used to determine if the service is now available, must return a Promise.
     * @param       {function}          params.fallback          Function executed if the service failed to deliver date.
     * @param       {number}            [params.timeout]         time in ms before a service call will timeout.
     * @param       {float}             [params.threshold]       % threshold for successful calls.
     *                                                           If the % of successful calls dips below this threshold the circuit will break.
     * @param       {number}            [params.waitThreshold]   number of requests to wait before testing circuit health.
     * @param       {number}            [params.statInterval]    interval in ms that brakes should emit a snapshot event.
     *
     * @return Promise
     */
    wrap : (params) => {
        let settings = {
            name          : params.name,
            group         : params.group,
            isFailure     : params.errorHandler,
            healthCheck   : params.healthCheck,
            fallback      : params.fallback,
            timeout       : params.timeout       | CircuitBreaker._settings.timeout,
            threshold     : params.threshold     | CircuitBreaker._settings.threshold,
            waitThreshold : params.waitThreshold | CircuitBreaker._settings.waitThreshold,
            statInterval  : params.statInterval  | CircuitBreaker._settings.statInterval
        };

        return (new Brakes(params.run, settings)).exec();
    },

    /**
     * Create an endpoint to be used in the Hystrix Dashboard.
     *
     * @private
     */
    _hystrixRoute : () => {
        let route = CircuitBreaker._settings.hystrixRoute;

        route.config.handler = (request, reply) => reply(globalStats.getHystrixStream());
        route.method         = 'GET';
        CircuitBreaker._server.route([route]);
    },

    register : (server, options, next) => {
        CircuitBreaker._settings = _.extend({}, CircuitBreaker._settings, options);
        CircuitBreaker._server   = server;

        if (CircuitBreaker._settings.hystrixRoute !== true) {
            CircuitBreaker._hystrixRoute();
        }

        server.expose('wrap', CircuitBreaker.wrap);

        next();
    }
};

module.exports.register = CircuitBreaker.register;

exports.register.attributes = {
    pkg : require('./package')
};
