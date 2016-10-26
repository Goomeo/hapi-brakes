'use strict';

const _ = require('lodash');

const Circuits = (() => {
    var instance;

    this.getInstance = () => {
        if (!instance) {
            instance = this.createInstance();
        }
        return instance;
    };

    this.createInstance = () => {
        return {};
    };

    return {
        findCircuit : (id) => {
            return this.getInstance()[id];
        },

        addCircuit : (id, circuit) => {
            this.getInstance()[id] = circuit;
        },

        updateCircuit : (id, circuit) => {
            return _.extend(this.getInstance()[id], circuit); // slow method, but parse all key
            // var instance = this.getInstance()[id];
            //
            // instance.run = circuit.run;
            // instance.isFailure = circuit.isFailure;
            // instance.healthCheck = circuit.healthCheck;
            // instance.fallback = circuit.fallback;
        }
    };
})();

module.exports = Circuits;
