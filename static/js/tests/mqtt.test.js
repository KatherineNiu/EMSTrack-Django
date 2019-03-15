const expect = require('chai').expect;

var settings = require('./mqtt/client-harness');

import { MqttClient } from "../mqtt";

describe('mqtt connection', () => {

    const mqttClient = new MqttClient('localhost', 8884, 'test-client', 1);

    const userName = 'admin';
    const password = 'cruzrojaadmin';

    it('should connect', function(done) {

        mqttClient.connect({
            userName: userName,
            password: password,
            onSuccess: () => {
                done();
            },
            onFailure: (cntxt, errorCode, errorMessage) => {
                done(errorMessage);
            }
        });

    });

    it('is connected', function() {

        expect(mqttClient.isConnected).to.equal(true);

    });

    it('should disconnect', function(done) {

        const resolvingPromise = new Promise(function(resolve, reject) {
            // the function is executed automatically when the promise is constructed
            mqttClient.disconnect();
            while (mqttClient.isConnected) { /* wait */ }
            resolve('disconnected');

            setTimeout(() => reject(new Error("timeout!")), 1000);
        });

        resolvingPromise
            .then(
                (result) => {
                    expect(result).to.equal('disconnected');
                    expect(mqttClient.isConnected).to.equal(false);
                    expect(mqttClient.client).to.equal(null);
                },
                () => {}
            )
            .finally(done);

    })

});

describe('mqtt messages', () => {

    const mqttClient = new MqttClient('localhost', 8884, 'test-client', 1);

    const userName = 'admin';
    const password = 'cruzrojaadmin';

    it('connect', function(done) {

        mqttClient.connect({
            userName: userName,
            password: password,
            onSuccess: () => {
                done();
            },
            onFailure: (cntxt, errorCode, errorMessage) => {
                done(errorMessage);
            }
        });

    });

    it('subscribe', function(done) {

        mqttClient.subscribe('test/message', {
            onSuccess: () => {
                done();
            },
            onFailure: (cntxt, errorCode, errorMessage) => {
                done(errorMessage);
            }
        })

    });

    it('send message', function(done) {

        const fn = (event) =>  {
            if (event === 'messageSent')
                done();
        };

        mqttClient.observe(fn);
        mqttClient.publish('test/message', 'Hi!', 2, false);
        setTimeout(() => done('error'), 1000);

    });

    it('disconnect', function(done) {

        const resolvingPromise = new Promise(function(resolve, reject) {
            // the function is executed automatically when the promise is constructed
            mqttClient.disconnect();
            while (mqttClient.isConnected) { /* wait */ }
            resolve('disconnected');

            setTimeout(() => reject(new Error("timeout!")), 1000);
        });

        resolvingPromise
            .then(
                (result) => {
                    expect(result).to.equal('disconnected');
                    expect(mqttClient.isConnected).to.equal(false);
                    expect(mqttClient.client).to.equal(null);
                },
                () => {}
            )
            .finally(done);

    })

});
