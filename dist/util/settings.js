"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
const data_1 = __importDefault(require("./data"));
const utils_1 = __importDefault(require("./utils"));
const object_assign_deep_1 = __importDefault(require("object-assign-deep"));
const path_1 = __importDefault(require("path"));
const yaml_1 = __importDefault(require("./yaml"));
const ajv_1 = __importDefault(require("ajv"));
const settings_schema_json_1 = __importDefault(require("./settings.schema.json"));
exports.schema = settings_schema_json_1.default;
// @ts-ignore
exports.schema = {};
object_assign_deep_1.default(exports.schema, settings_schema_json_1.default);
// Remove legacy settings from schema
{
    delete exports.schema.properties.advanced.properties.homeassistant_discovery_topic;
    delete exports.schema.properties.advanced.properties.homeassistant_legacy_entity_attributes;
    delete exports.schema.properties.advanced.properties.homeassistant_legacy_triggers;
    delete exports.schema.properties.advanced.properties.homeassistant_status_topic;
    delete exports.schema.properties.advanced.properties.soft_reset_timeout;
    delete exports.schema.properties.advanced.properties.report;
    delete exports.schema.properties.advanced.properties.baudrate;
    delete exports.schema.properties.advanced.properties.rtscts;
    delete exports.schema.properties.advanced.properties.ikea_ota_use_test_url;
    delete exports.schema.properties.experimental;
    delete settings_schema_json_1.default.properties.whitelist;
    delete settings_schema_json_1.default.properties.ban;
}
// DEPRECATED ZIGBEE2MQTT_CONFIG: https://github.com/Koenkk/zigbee2mqtt/issues/4697
const file = (_a = process.env.ZIGBEE2MQTT_CONFIG) !== null && _a !== void 0 ? _a : data_1.default.joinPath('configuration.yaml');
const ajvSetting = new ajv_1.default({ allErrors: true }).addKeyword('requiresRestart').compile(settings_schema_json_1.default);
const ajvRestartRequired = new ajv_1.default({ allErrors: true })
    .addKeyword({ keyword: 'requiresRestart', validate: (s) => !s }).compile(settings_schema_json_1.default);
const defaults = {
    permit_join: false,
    external_converters: [],
    mqtt: {
        base_topic: 'zigbee2mqtt',
        include_device_information: false,
        force_disable_retain: false,
    },
    serial: {
        disable_led: false,
    },
    passlist: [],
    blocklist: [],
    map_options: {
        graphviz: {
            colors: {
                fill: {
                    enddevice: '#fff8ce',
                    coordinator: '#e04e5d',
                    router: '#4ea3e0',
                },
                font: {
                    coordinator: '#ffffff',
                    router: '#ffffff',
                    enddevice: '#000000',
                },
                line: {
                    active: '#009900',
                    inactive: '#994444',
                },
            },
        },
    },
    ota: {
        update_check_interval: 24 * 60,
        disable_automatic_update_check: false,
    },
    device_options: {},
    advanced: {
        legacy_api: true,
        legacy_availability_payload: true,
        log_rotation: true,
        log_symlink_current: false,
        log_output: ['console', 'file'],
        log_directory: path_1.default.join(data_1.default.getPath(), 'log', '%TIMESTAMP%'),
        log_file: 'log.txt',
        log_level: /* istanbul ignore next */ process.env.DEBUG ? 'debug' : 'info',
        log_syslog: {},
        pan_id: 0x1a62,
        ext_pan_id: [0xDD, 0xDD, 0xDD, 0xDD, 0xDD, 0xDD, 0xDD, 0xDD],
        channel: 11,
        adapter_concurrent: null,
        adapter_delay: null,
        cache_state: true,
        cache_state_persistent: true,
        cache_state_send_on_startup: true,
        last_seen: 'disable',
        elapsed: false,
        network_key: [1, 3, 5, 7, 9, 11, 13, 15, 0, 2, 4, 6, 8, 10, 12, 13],
        timestamp_format: 'YYYY-MM-DD HH:mm:ss',
        output: 'json',
        // Everything below is deprecated
        availability_blocklist: [],
        availability_passlist: [],
        availability_blacklist: [],
        availability_whitelist: [],
        soft_reset_timeout: 0,
        report: false,
    },
};
let _settings;
let _settingsWithDefaults;
function loadSettingsWithDefaults() {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
    _settingsWithDefaults = object_assign_deep_1.default({}, defaults, getInternalSettings());
    if (!_settingsWithDefaults.devices) {
        _settingsWithDefaults.devices = {};
    }
    if (!_settingsWithDefaults.groups) {
        _settingsWithDefaults.groups = {};
    }
    if (_settingsWithDefaults.homeassistant) {
        const defaults = { discovery_topic: 'homeassistant', status_topic: 'hass/status',
            legacy_entity_attributes: true, legacy_triggers: true };
        const sLegacy = {};
        if (_settingsWithDefaults.advanced) {
            for (const key of ['homeassistant_legacy_triggers', 'homeassistant_discovery_topic',
                'homeassistant_legacy_entity_attributes', 'homeassistant_status_topic']) {
                // @ts-ignore
                if (_settingsWithDefaults.advanced[key] !== undefined) {
                    // @ts-ignore
                    sLegacy[key.replace('homeassistant_', '')] = _settingsWithDefaults.advanced[key];
                }
            }
        }
        const s = typeof _settingsWithDefaults.homeassistant === 'object' ? _settingsWithDefaults.homeassistant : {};
        // @ts-ignore
        _settingsWithDefaults.homeassistant = {};
        object_assign_deep_1.default(_settingsWithDefaults.homeassistant, defaults, sLegacy, s);
    }
    if (_settingsWithDefaults.availability || ((_a = _settingsWithDefaults.advanced) === null || _a === void 0 ? void 0 : _a.availability_timeout)) {
        const defaults = {};
        const s = typeof _settingsWithDefaults.availability === 'object' ? _settingsWithDefaults.availability : {};
        // @ts-ignore
        _settingsWithDefaults.availability = {};
        object_assign_deep_1.default(_settingsWithDefaults.availability, defaults, s);
    }
    if (_settingsWithDefaults.frontend) {
        const defaults = { port: 8080, auth_token: false, host: '0.0.0.0' };
        const s = typeof _settingsWithDefaults.frontend === 'object' ? _settingsWithDefaults.frontend : {};
        // @ts-ignore
        _settingsWithDefaults.frontend = {};
        object_assign_deep_1.default(_settingsWithDefaults.frontend, defaults, s);
    }
    if (((_b = _settings.advanced) === null || _b === void 0 ? void 0 : _b.hasOwnProperty('baudrate')) && ((_c = _settings.serial) === null || _c === void 0 ? void 0 : _c.baudrate) == null) {
        // @ts-ignore
        _settingsWithDefaults.serial.baudrate = _settings.advanced.baudrate;
    }
    if (((_d = _settings.advanced) === null || _d === void 0 ? void 0 : _d.hasOwnProperty('rtscts')) && ((_e = _settings.serial) === null || _e === void 0 ? void 0 : _e.rtscts) == null) {
        // @ts-ignore
        _settingsWithDefaults.serial.rtscts = _settings.advanced.rtscts;
    }
    if (((_f = _settings.advanced) === null || _f === void 0 ? void 0 : _f.hasOwnProperty('ikea_ota_use_test_url')) && ((_g = _settings.ota) === null || _g === void 0 ? void 0 : _g.ikea_ota_use_test_url) == null) {
        // @ts-ignore
        _settingsWithDefaults.ota.ikea_ota_use_test_url = _settings.advanced.ikea_ota_use_test_url;
    }
    // @ts-ignore
    if (((_h = _settings.experimental) === null || _h === void 0 ? void 0 : _h.hasOwnProperty('transmit_power')) && ((_j = _settings.advanced) === null || _j === void 0 ? void 0 : _j.transmit_power) == null) {
        // @ts-ignore
        _settingsWithDefaults.advanced.transmit_power = _settings.experimental.transmit_power;
    }
    // @ts-ignore
    if (((_k = _settings.experimental) === null || _k === void 0 ? void 0 : _k.hasOwnProperty('output')) && ((_l = _settings.advanced) === null || _l === void 0 ? void 0 : _l.output) == null) {
        // @ts-ignore
        _settingsWithDefaults.advanced.output = _settings.experimental.output;
    }
    // @ts-ignore
    _settingsWithDefaults.ban && _settingsWithDefaults.blocklist.push(..._settingsWithDefaults.ban);
    // @ts-ignore
    _settingsWithDefaults.whitelist && _settingsWithDefaults.passlist.push(..._settingsWithDefaults.whitelist);
}
function write() {
    const settings = getInternalSettings();
    const toWrite = object_assign_deep_1.default({}, settings);
    // Read settings to check if we have to split devices/groups into separate file.
    const actual = yaml_1.default.read(file);
    // In case the setting is defined in a separte file (e.g. !secret network_key) update it there.
    for (const path of [
        ['mqtt', 'server'],
        ['mqtt', 'user'],
        ['mqtt', 'password'],
        ['advanced', 'network_key'],
        ['frontend', 'auth_token'],
    ]) {
        if (actual[path[0]] && actual[path[0]][path[1]]) {
            const match = /!(.*) (.*)/g.exec(actual[path[0]][path[1]]);
            if (match) {
                yaml_1.default.updateIfChanged(data_1.default.joinPath(`${match[1]}.yaml`), match[2], toWrite[path[0]][path[1]]);
                toWrite[path[0]][path[1]] = actual[path[0]][path[1]];
            }
        }
    }
    // Write devices/groups to separate file if required.
    const writeDevicesOrGroups = (type) => {
        if (typeof actual[type] === 'string' || Array.isArray(actual[type])) {
            const fileToWrite = Array.isArray(actual[type]) ? actual[type][0] : actual[type];
            const content = object_assign_deep_1.default({}, settings[type]);
            // If an array, only write to first file and only devices which are not in the other files.
            if (Array.isArray(actual[type])) {
                actual[type].filter((f, i) => i !== 0)
                    .map((f) => yaml_1.default.readIfExists(data_1.default.joinPath(f), {}))
                    .map((c) => Object.keys(c))
                    .forEach((k) => delete content[k]);
            }
            yaml_1.default.writeIfChanged(data_1.default.joinPath(fileToWrite), content);
            toWrite[type] = actual[type];
        }
    };
    writeDevicesOrGroups('devices');
    writeDevicesOrGroups('groups');
    yaml_1.default.writeIfChanged(file, toWrite);
    _settings = read();
    loadSettingsWithDefaults();
}
function validate() {
    try {
        getInternalSettings();
    }
    catch (error) {
        if (error.name === 'YAMLException') {
            return [
                `Your YAML file: '${error.file}' is invalid ` +
                    `(use https://jsonformatter.org/yaml-validator to find and fix the issue)`,
            ];
        }
        return [error.message];
    }
    if (!ajvSetting(_settings)) {
        return ajvSetting.errors.map((v) => `${v.instancePath.substring(1)} ${v.message}`);
    }
    const errors = [];
    if (_settings.advanced && _settings.advanced.network_key && typeof _settings.advanced.network_key === 'string' &&
        _settings.advanced.network_key !== 'GENERATE') {
        errors.push(`advanced.network_key: should be array or 'GENERATE' (is '${_settings.advanced.network_key}')`);
    }
    if (_settings.advanced && _settings.advanced.pan_id && typeof _settings.advanced.pan_id === 'string' &&
        _settings.advanced.pan_id !== 'GENERATE') {
        errors.push(`advanced.pan_id: should be number or 'GENERATE' (is '${_settings.advanced.pan_id}')`);
    }
    // Verify that all friendly names are unique
    const names = [];
    const check = (e) => {
        if (names.includes(e.friendly_name))
            errors.push(`Duplicate friendly_name '${e.friendly_name}' found`);
        errors.push(...utils_1.default.validateFriendlyName(e.friendly_name));
        names.push(e.friendly_name);
        if (e.qos != null && ![0, 1, 2].includes(e.qos)) {
            errors.push(`QOS for '${e.friendly_name}' not valid, should be 0, 1 or 2 got ${e.qos}`);
        }
    };
    const settingsWithDefaults = get();
    Object.values(settingsWithDefaults.devices).forEach((d) => check(d));
    Object.values(settingsWithDefaults.groups).forEach((g) => check(g));
    if (settingsWithDefaults.mqtt.version !== 5) {
        for (const device of Object.values(settingsWithDefaults.devices)) {
            if (device.retention) {
                errors.push('MQTT retention requires protocol version 5');
            }
        }
    }
    const checkAvailabilityList = (list, type) => {
        list.forEach((e) => {
            if (!getDevice(e)) {
                errors.push(`Non-existing entity '${e}' specified in '${type}'`);
            }
        });
    };
    checkAvailabilityList(settingsWithDefaults.advanced.availability_blacklist, 'availability_blacklist');
    checkAvailabilityList(settingsWithDefaults.advanced.availability_whitelist, 'availability_whitelist');
    checkAvailabilityList(settingsWithDefaults.advanced.availability_blocklist, 'availability_blocklist');
    checkAvailabilityList(settingsWithDefaults.advanced.availability_passlist, 'availability_passlist');
    return errors;
}
exports.validate = validate;
function read() {
    var _a, _b, _c, _d, _e;
    const s = yaml_1.default.read(file);
    // Read !secret MQTT username and password if set
    // eslint-disable-next-line
    const interpetValue = (value) => {
        const re = /!(.*) (.*)/g;
        const match = re.exec(value);
        if (match) {
            const file = data_1.default.joinPath(`${match[1]}.yaml`);
            const key = match[2];
            return yaml_1.default.read(file)[key];
        }
        else {
            return value;
        }
    };
    if ((_a = s.mqtt) === null || _a === void 0 ? void 0 : _a.user) {
        s.mqtt.user = interpetValue(s.mqtt.user);
    }
    if ((_b = s.mqtt) === null || _b === void 0 ? void 0 : _b.password) {
        s.mqtt.password = interpetValue(s.mqtt.password);
    }
    if ((_c = s.mqtt) === null || _c === void 0 ? void 0 : _c.server) {
        s.mqtt.server = interpetValue(s.mqtt.server);
    }
    if ((_d = s.advanced) === null || _d === void 0 ? void 0 : _d.network_key) {
        s.advanced.network_key = interpetValue(s.advanced.network_key);
    }
    if ((_e = s.frontend) === null || _e === void 0 ? void 0 : _e.auth_token) {
        s.frontend.auth_token = interpetValue(s.frontend.auth_token);
    }
    // Read devices/groups configuration from separate file if specified.
    const readDevicesOrGroups = (type) => {
        if (typeof s[type] === 'string' || Array.isArray(s[type])) {
            /* eslint-disable-line */ // @ts-ignore
            const files = Array.isArray(s[type]) ? s[type] : [s[type]];
            s[type] = {};
            for (const file of files) {
                const content = yaml_1.default.readIfExists(data_1.default.joinPath(file), {});
                /* eslint-disable-line */ // @ts-ignore
                s[type] = object_assign_deep_1.default.noMutate(s[type], content);
            }
        }
    };
    readDevicesOrGroups('devices');
    readDevicesOrGroups('groups');
    return s;
}
function applyEnvironmentVariables(settings) {
    const iterate = (obj, path) => {
        Object.keys(obj).forEach((key) => {
            if (key !== 'type') {
                if (key !== 'properties' && obj[key]) {
                    const type = (obj[key].type || 'object').toString();
                    const envPart = path.reduce((acc, val) => `${acc}${val}_`, '');
                    const envVariableName = (`ZIGBEE2MQTT_CONFIG_${envPart}${key}`).toUpperCase();
                    if (process.env[envVariableName]) {
                        const setting = path.reduce((acc, val) => {
                            /* eslint-disable-line */ // @ts-ignore
                            acc[val] = acc[val] || {};
                            /* eslint-disable-line */ // @ts-ignore
                            return acc[val];
                        }, settings);
                        if (type.indexOf('object') >= 0 || type.indexOf('array') >= 0) {
                            try {
                                setting[key] = JSON.parse(process.env[envVariableName]);
                            }
                            catch (error) {
                                setting[key] = process.env[envVariableName];
                            }
                        }
                        else if (type.indexOf('number') >= 0) {
                            /* eslint-disable-line */ // @ts-ignore
                            setting[key] = process.env[envVariableName] * 1;
                        }
                        else if (type.indexOf('boolean') >= 0) {
                            setting[key] = process.env[envVariableName].toLowerCase() === 'true';
                        }
                        else {
                            /* istanbul ignore else */
                            if (type.indexOf('string') >= 0) {
                                setting[key] = process.env[envVariableName];
                            }
                        }
                    }
                }
                if (typeof obj[key] === 'object' && obj[key]) {
                    const newPath = [...path];
                    if (key !== 'properties' && key !== 'oneOf' && !Number.isInteger(Number(key))) {
                        newPath.push(key);
                    }
                    iterate(obj[key], newPath);
                }
            }
        });
    };
    iterate(settings_schema_json_1.default.properties, []);
}
function getInternalSettings() {
    if (!_settings) {
        _settings = read();
        applyEnvironmentVariables(_settings);
    }
    return _settings;
}
function get() {
    if (!_settingsWithDefaults) {
        loadSettingsWithDefaults();
    }
    return _settingsWithDefaults;
}
exports.get = get;
function set(path, value) {
    /* eslint-disable-next-line */
    let settings = getInternalSettings();
    for (let i = 0; i < path.length; i++) {
        const key = path[i];
        if (i === path.length - 1) {
            settings[key] = value;
        }
        else {
            if (!settings[key]) {
                settings[key] = {};
            }
            settings = settings[key];
        }
    }
    write();
}
exports.set = set;
function apply(newSettings) {
    ajvSetting(newSettings);
    const errors = ajvSetting.errors && ajvSetting.errors.filter((e) => e.keyword !== 'required');
    if (errors.length) {
        const error = errors[0];
        throw new Error(`${error.instancePath.substring(1)} ${error.message}`);
    }
    getInternalSettings(); // Ensure _settings is intialized.
    /* eslint-disable-line */ // @ts-ignore
    _settings = object_assign_deep_1.default.noMutate(_settings, newSettings);
    write();
    ajvRestartRequired(newSettings);
    const restartRequired = ajvRestartRequired.errors &&
        !!ajvRestartRequired.errors.find((e) => e.keyword === 'requiresRestart');
    return restartRequired;
}
exports.apply = apply;
function getGroup(IDorName) {
    const settings = get();
    const byID = settings.groups[IDorName];
    if (byID) {
        return { devices: [], ...byID, ID: Number(IDorName) };
    }
    for (const [ID, group] of Object.entries(settings.groups)) {
        if (group.friendly_name === IDorName) {
            return { devices: [], ...group, ID: Number(ID) };
        }
    }
    return null;
}
exports.getGroup = getGroup;
function getGroups() {
    const settings = get();
    return Object.entries(settings.groups).map(([ID, group]) => {
        return { devices: [], ...group, ID: Number(ID) };
    });
}
exports.getGroups = getGroups;
function getGroupThrowIfNotExists(IDorName) {
    const group = getGroup(IDorName);
    if (!group) {
        throw new Error(`Group '${IDorName}' does not exist`);
    }
    return group;
}
function getDevice(IDorName) {
    const settings = get();
    const byID = settings.devices[IDorName];
    if (byID) {
        return { ...byID, ID: IDorName };
    }
    for (const [ID, device] of Object.entries(settings.devices)) {
        if (device.friendly_name === IDorName) {
            return { ...device, ID };
        }
    }
    return null;
}
exports.getDevice = getDevice;
function getDeviceThrowIfNotExists(IDorName) {
    const device = getDevice(IDorName);
    if (!device) {
        throw new Error(`Device '${IDorName}' does not exist`);
    }
    return device;
}
function addDevice(ID) {
    if (getDevice(ID)) {
        throw new Error(`Device '${ID}' already exists`);
    }
    const settings = getInternalSettings();
    if (!settings.devices) {
        settings.devices = {};
    }
    settings.devices[ID] = { friendly_name: ID };
    write();
    return getDevice(ID);
}
exports.addDevice = addDevice;
function addDeviceToPasslist(ID) {
    const settings = getInternalSettings();
    if (!settings.passlist) {
        settings.passlist = [];
    }
    if (settings.passlist.includes(ID)) {
        throw new Error(`Device '${ID}' already in passlist`);
    }
    settings.passlist.push(ID);
    write();
}
exports.addDeviceToPasslist = addDeviceToPasslist;
function blockDevice(ID) {
    const settings = getInternalSettings();
    if (!settings.blocklist) {
        settings.blocklist = [];
    }
    settings.blocklist.push(ID);
    write();
}
exports.blockDevice = blockDevice;
function removeDevice(IDorName) {
    const device = getDeviceThrowIfNotExists(IDorName);
    const settings = getInternalSettings();
    delete settings.devices[device.ID];
    // Remove device from groups
    if (settings.groups) {
        const regex = new RegExp(`^(${device.friendly_name}|${device.ID})(/(\\d|${utils_1.default.endpointNames.join('|')}))?$`);
        for (const group of Object.values(settings.groups).filter((g) => g.devices)) {
            group.devices = group.devices.filter((device) => !device.match(regex));
        }
    }
    write();
}
exports.removeDevice = removeDevice;
function addGroup(name, ID) {
    utils_1.default.validateFriendlyName(name, true);
    if (getGroup(name) || getDevice(name)) {
        throw new Error(`friendly_name '${name}' is already in use`);
    }
    const settings = getInternalSettings();
    if (!settings.groups) {
        settings.groups = {};
    }
    if (ID == null) {
        // look for free ID
        ID = '1';
        while (settings.groups.hasOwnProperty(ID)) {
            ID = (Number.parseInt(ID) + 1).toString();
        }
    }
    else {
        // ensure provided ID is not in use
        ID = ID.toString();
        if (settings.groups.hasOwnProperty(ID)) {
            throw new Error(`Group ID '${ID}' is already in use`);
        }
    }
    settings.groups[ID] = { friendly_name: name };
    write();
    return getGroup(ID);
}
exports.addGroup = addGroup;
function groupGetDevice(group, keys) {
    var _a;
    for (const device of (_a = group.devices) !== null && _a !== void 0 ? _a : []) {
        if (keys.includes(device))
            return device;
    }
    return null;
}
function addDeviceToGroup(IDorName, keys) {
    const groupID = getGroupThrowIfNotExists(IDorName).ID;
    const settings = getInternalSettings();
    const group = settings.groups[groupID];
    if (!groupGetDevice(group, keys)) {
        if (!group.devices)
            group.devices = [];
        group.devices.push(keys[0]);
        write();
    }
}
exports.addDeviceToGroup = addDeviceToGroup;
function removeDeviceFromGroup(IDorName, keys) {
    const groupID = getGroupThrowIfNotExists(IDorName).ID;
    const settings = getInternalSettings();
    const group = settings.groups[groupID];
    if (!group.devices) {
        return;
    }
    const key = groupGetDevice(group, keys);
    if (key) {
        group.devices = group.devices.filter((d) => d != key);
        write();
    }
}
exports.removeDeviceFromGroup = removeDeviceFromGroup;
function removeGroup(IDorName) {
    const groupID = getGroupThrowIfNotExists(IDorName.toString()).ID;
    const settings = getInternalSettings();
    delete settings.groups[groupID];
    write();
}
exports.removeGroup = removeGroup;
function changeEntityOptions(IDorName, newOptions) {
    const settings = getInternalSettings();
    delete newOptions.friendly_name;
    delete newOptions.devices;
    if (getDevice(IDorName)) {
        object_assign_deep_1.default(settings.devices[getDevice(IDorName).ID], newOptions);
        utils_1.default.removeNullPropertiesFromObject(settings.devices[getDevice(IDorName).ID]);
    }
    else if (getGroup(IDorName)) {
        object_assign_deep_1.default(settings.groups[getGroup(IDorName).ID], newOptions);
        utils_1.default.removeNullPropertiesFromObject(settings.groups[getGroup(IDorName).ID]);
    }
    else {
        throw new Error(`Device or group '${IDorName}' does not exist`);
    }
    write();
}
exports.changeEntityOptions = changeEntityOptions;
function changeFriendlyName(IDorName, newName) {
    utils_1.default.validateFriendlyName(newName, true);
    if (getGroup(newName) || getDevice(newName)) {
        throw new Error(`friendly_name '${newName}' is already in use`);
    }
    const settings = getInternalSettings();
    if (getDevice(IDorName)) {
        settings.devices[getDevice(IDorName).ID].friendly_name = newName;
    }
    else if (getGroup(IDorName)) {
        settings.groups[getGroup(IDorName).ID].friendly_name = newName;
    }
    else {
        throw new Error(`Device or group '${IDorName}' does not exist`);
    }
    write();
}
exports.changeFriendlyName = changeFriendlyName;
function reRead() {
    _settings = null;
    getInternalSettings();
    _settingsWithDefaults = null;
    get();
}
exports.reRead = reRead;
exports.testing = {
    write,
    clear: () => {
        _settings = null;
        _settingsWithDefaults = null;
    },
    defaults,
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2V0dGluZ3MuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9saWIvdXRpbC9zZXR0aW5ncy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQSxrREFBMEI7QUFDMUIsb0RBQTRCO0FBQzVCLDRFQUFrRDtBQUNsRCxnREFBd0I7QUFDeEIsa0RBQTBCO0FBQzFCLDhDQUFzQjtBQUN0QixrRkFBZ0Q7QUFDckMsUUFBQSxNQUFNLEdBQUcsOEJBQVUsQ0FBQztBQUMvQixhQUFhO0FBQ2IsY0FBTSxHQUFHLEVBQUUsQ0FBQztBQUNaLDRCQUFnQixDQUFDLGNBQU0sRUFBRSw4QkFBVSxDQUFDLENBQUM7QUFFckMscUNBQXFDO0FBQ3JDO0lBQ0ksT0FBTyxjQUFNLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsNkJBQTZCLENBQUM7SUFDM0UsT0FBTyxjQUFNLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsc0NBQXNDLENBQUM7SUFDcEYsT0FBTyxjQUFNLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsNkJBQTZCLENBQUM7SUFDM0UsT0FBTyxjQUFNLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsMEJBQTBCLENBQUM7SUFDeEUsT0FBTyxjQUFNLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsa0JBQWtCLENBQUM7SUFDaEUsT0FBTyxjQUFNLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDO0lBQ3BELE9BQU8sY0FBTSxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQztJQUN0RCxPQUFPLGNBQU0sQ0FBQyxVQUFVLENBQUMsUUFBUSxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUM7SUFDcEQsT0FBTyxjQUFNLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxVQUFVLENBQUMscUJBQXFCLENBQUM7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