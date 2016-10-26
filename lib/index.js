'use strict';

const Brakes      = require('brakes');
const _           = require('lodash');
const globalStats = Brakes.getGlobalStats();
const Readable    = require('stream').Readable;
const Circuits    = require('./Circuits');

const CircuitBreaker = {
    _server : {},

    _settings : {
        hystrixRoute        : {
            method : 'GET',
            path   : '/hystrix',
            config : {
                tags : ['api', 'hystrix'],
            }
        },
        timeout             : 10000,
        group               : 'default'
    },

    /**
     * Wrap a request to another service within a CircuitBreaker command.
     *
     * -----------------------------------------------------------------------------------------------------------------
     * @param   {object}     params                         Function's params.
     * -----------------------------------------------------------------------------------------------------------------
     * @param   {string}     params.name                    hystrix command name, must be unique.
     * @param   {string}     [params.group]                 hystrix command group, used to group different command.
     * -----------------------------------------------------------------------------------------------------------------
     * @param   {function}   params.run                     Wrapped function executed, must return a Promise.
     * -----------------------------------------------------------------------------------------------------------------
     * @param   {function}   [params.isFailure]             Function used to determine if the function failed or not,
     *                                                          must return a Boolean.
     * -----------------------------------------------------------------------------------------------------------------
     * @param   {function}   [params.healthCheck]           Function used to determine if the service is now available,
     *                                                          must return a Promise.
     * @param   {number}     [params.healthCheckInterval]
     * -----------------------------------------------------------------------------------------------------------------
     * @param   {function}   [params.fallback]              Function executed if the service failed to deliver date,
     *                                                          must return a Promise.
     * -----------------------------------------------------------------------------------------------------------------
     * @param   {number}     [params.timeout]               time in ms before a service call will timeout.
     * -----------------------------------------------------------------------------------------------------------------
     * @param   {float}      [params.threshold]             % threshold for successful calls. If the % of successful
     *                                                          calls dips below this threshold the circuit will break.
     * @param   {number}     [params.waitThreshold]         number of requests to wait before testing circuit health.
     * -----------------------------------------------------------------------------------------------------------------
     * @param   {number}     [params.statInterval]          interval in ms that brakes should emit a snapshot event.
     * -----------------------------------------------------------------------------------------------------------------
     * @return Brake instance
     */
    wrap : (params) => {
        let settings = _.extend({}, _.omit(CircuitBreaker._settings, 'hystrixRoute'), _.omit(params, 'run'));
        let circuit = null;

        settings.id = '' + settings.name + settings.group;
        if (!(circuit = Circuits.findCircuit(settings.id))) {
            circuit = new Brakes(params.run, settings);
            Circuits.addCircuit(settings.id, circuit);
        } else {
            Circuits.updateCircuit(settings.id, circuit);
        }
        return circuit;
    },

    /**
     * Create an endpoint to be used in the Hystrix Dashboard.
     *
     * @private
     */
    _hystrixRoute : () => {
        let route = CircuitBreaker._settings.hystrixRoute;

        route.config.handler = (request, reply) => {
            reply(new Readable().wrap(globalStats.getHystrixStream()))
                .header('content-type', 'text/event-stream')
                .header('content-encoding', 'identity')
                // .header('Pragma', 'no-cache')
                .header('Cache-Control', 'no-cache, no-store, max-age=0, must-revalidate');

        };
        route.method         = 'GET';
        CircuitBreaker._server.route([route]);
    },

    register : (server, options, next) => {
        server.dependency('susie', (server, next) => {
            CircuitBreaker._settings = _.extend({}, CircuitBreaker._settings, options);
            CircuitBreaker._server   = server;

            if (CircuitBreaker._settings.hystrixRoute !== false) {
                CircuitBreaker._hystrixRoute();
            }

            server.decorate('server', 'circuitBreaker', {
                wrap : CircuitBreaker.wrap
            });

            next();
        });
        next();
    }
};

module.exports.register = CircuitBreaker.register;

exports.register.attributes = {
    pkg : require('./../package')
};
