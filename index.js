"use strict";

const mqtt = require("mqtt");

let Accessory, Service, Characteristic, DoorState, PlatformAccessory;

function ChickenCoopPlatform(log, config, api) {
  log("ChickenCoopPlatform Init");

  this.log = log;
  this.config = config;
  this.accessories = [];

  let platform = this;

  // info service
  this.infoService = new Service.AccessoryInformation();
  this.infoService
    .setCharacteristic(Characteristic.Manufacturer, "Björn Schmitt")
    .setCharacteristic(Characteristic.Model, "Homebridge Tasmota Chicken Coop")
    .setCharacteristic(Characteristic.FirmwareRevision, "1.0.0");

  // chicken door service
  this.garageDoorOpener = new Service.GarageDoorOpener(this.config.name);
  this.currentDoorState = this.garageDoorOpener.getCharacteristic(
    Characteristic.CurrentDoorState
  );
  this.currentDoorState.on("get", this.getState.bind(this));

  this.targetDoorState = this.garageDoorOpener.getCharacteristic(
    Characteristic.TargetDoorState
  );
  this.targetDoorState
    .on("set", this.setTargetState.bind(this))
    .on("get", this.checkReachable.bind(this));

  this.ObstructionDetected = this.garageDoorOpener.getCharacteristic(
    Characteristic.ObstructionDetected
  );
  this.ObstructionDetected.on("get", this.checkReachable.bind(this));

  // MQTT
  this.client = mqtt.connect(this.config.mqHost, {
    keepalive: 10,
    clientId: Math.random()
      .toString(16)
      .substr(2, 8),
    protocolId: "MQTT",
    protocolVersion: 4,
    clean: true,
    reconnectPeriod: 2000,
    connectTimeout: 30 * 1000,
    will: {
      topic: "/lwt",
      payload: this.config.name + " Connection closed ...",
      qos: 0,
      retain: false
    },
    username: this.config.mqUsername,
    password: this.config.mqPassword,
    rejectUnauthorized: false
  });

  this.client.on("error", function(e) {
    platform.log("MQTT error" + e);
  });

  // subscribe on connection
  this.client.on("connect", function() {
    for (topic in ["doorPower", "fanPower", "heaterPower"]) {
      platform.client.subscribe("stat/chick/" + platform.config.topics[topic]);
    }
    if (platform.config.lwt !== undefined)
      platform.client.subscribe(platform.config.lwt);
  });

  // receive message
  this.client.on("message", function(topic, message) {
    let status = message.toString();
    platform.showLog(status);
  });
}

ChickenCoopPlatform.prototype = {
  showLog: function(msg, state) {
    if (this.config.verbose !== undefined) {
      if (msg !== undefined) {
        this.log(msg);
      }
      if (state !== undefined) {
        this.log("State: " + state);
      }
      this.log("----");
    }
  },

  checkReachable: function(callback) {
    this.showLog("checkReachable");
    if (this.reachable) {
      callback();
    } else {
      callback(1);
    }
  },

  getState: function(callback) {
    this.showLog("getState");
    if (this.reachable) {
      callback();
    } else {
      callback(1);
    }
  },

  setTargetState: function(state, callback, context) {
    this.showLog("setTargetState:", state);
    if (this.reachable) {
      callback();
    } else {
      callback(1);
    }
  },

  getServices: function() {
    return [this.infoService, this.garageDoorOpener];
  }
};

module.exports = function(homebridge) {
  console.log("homebridge API version: " + homebridge.version);

  Accessory = homebridge.platformAccessory;
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;
  UUIDGen = homebridge.hap.uuid;

  homebridge.registerPlatform(
    "homebridge-tasmota-chicken-coop",
    "tasmota-chicken-coop",
    ChickenCoopPlatform,
    true
  );
};
