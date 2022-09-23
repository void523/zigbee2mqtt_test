"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const es6_1 = __importDefault(require("fast-deep-equal/es6"));
const humanize_duration_1 = __importDefault(require("humanize-duration"));
const data_1 = __importDefault(require("./data"));
const vm_1 = __importDefault(require("vm"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// construct a local ISO8601 string (instead of UTC-based)
// Example:
//  - ISO8601 (UTC) = 2019-03-01T15:32:45.941+0000
//  - ISO8601 (local) = 2019-03-01T16:32:45.941+0100 (for timezone GMT+1)
function toLocalISOString(date) {
    const tzOffset = -date.getTimezoneOffset();
    const plusOrMinus = tzOffset >= 0 ? '+' : '-';
    const pad = (num) => {
        const norm = Math.floor(Math.abs(num));
        return (norm < 10 ? '0' : '') + norm;
    };
    return date.getFullYear() +
        '-' + pad(date.getMonth() + 1) +
        '-' + pad(date.getDate()) +
        'T' + pad(date.getHours()) +
        ':' + pad(date.getMinutes()) +
        ':' + pad(date.getSeconds()) +
        plusOrMinus + pad(tzOffset / 60) +
        ':' + pad(tzOffset % 60);
}
const endpointNames = [
    'left', 'right', 'center', 'bottom_left', 'bottom_right', 'default',
    'top_left', 'top_right', 'white', 'rgb', 'cct', 'system', 'top', 'bottom', 'center_left', 'center_right',
    'ep1', 'ep2', 'row_1', 'row_2', 'row_3', 'row_4', 'relay', 'usb',
    'l1', 'l2', 'l3', 'l4', 'l5', 'l6', 'l7', 'l8',
    'l9', 'l10', 'l11', 'l12', 'l13', 'l14', 'l15', 'l16',
    'button_1', 'button_2', 'button_3', 'button_4', 'button_5',
    'button_6', 'button_7', 'button_8', 'button_9', 'button_10',
    'button_11', 'button_12', 'button_13', 'button_14', 'button_15',
    'button_16', 'button_17', 'button_18', 'button_19', 'button_20',
    'button_light', 'button_fan_high', 'button_fan_med', 'button_fan_low',
    'heat', 'cool', 'water', 'meter', 'wifi', 'no_occupancy_since',
];
function capitalize(s) {
    return s[0].toUpperCase() + s.slice(1);
}
async function getZigbee2MQTTVersion(includeCommitHash = true) {
    const git = await Promise.resolve().then(() => __importStar(require('git-last-commit')));
    const packageJSON = await Promise.resolve().then(() => __importStar(require('../..' + '/package.json')));
    if (!includeCommitHash) {
        return { version: packageJSON.version, commitHash: null };
    }
    return new Promise((resolve) => {
        const version = packageJSON.version;
        git.getLastCommit((err, commit) => {
            let commitHash = null;
            if (err) {
                try {
                    commitHash = fs_1.default.readFileSync(path_1.default.join(__dirname, '..', '..', 'dist', '.hash'), 'utf-8');
                }
                catch (error) {
                    /* istanbul ignore next */
                    commitHash = 'unknown';
                }
            }
            else {
                commitHash = commit.shortHash;
            }
            commitHash = commitHash.trim();
            resolve({ commitHash, version });
        });
    });
}
async function getDependencyVersion(depend) {
    const packageJSON = await Promise.resolve().then(() => __importStar(require(path_1.default.join(__dirname, '..', '..', 'node_modules', depend, 'package.json'))));
    const version = packageJSON.version;
    return { version };
}
function formatDate(time, type) {
    if (type === 'ISO_8601')
        return new Date(time).toISOString();
    else if (type === 'ISO_8601_local')
        return toLocalISOString(new Date(time));
    else if (type === 'epoch')
        return time;
    else { // relative
        return humanize_duration_1.default(Date.now() - time, { language: 'en', largest: 2, round: true }) + ' ago';
    }
}
function objectHasProperties(object, properties) {
    for (const property of properties) {
        if (!object.hasOwnProperty(property)) {
            return false;
        }
    }
    return true;
}
function equalsPartial(object, expected) {
    for (const [key, value] of Object.entries(expected)) {
        if (!es6_1.default(object[key], value)) {
            return false;
        }
    }
    return true;
}
function getObjectProperty(object, key, defaultValue) {
    return object && object.hasOwnProperty(key) ? object[key] : defaultValue;
}
function getResponse(request, data, error) {
    const response = { data, status: error ? 'error' : 'ok' };
    if (error)
        response.error = error;
    if (typeof request === 'object' && request.hasOwnProperty('transaction')) {
        response.transaction = request.transaction;
    }
    return response;
}
function parseJSON(value, fallback) {
    try {
        return JSON.parse(value);
    }
    catch (e) {
        return fallback;
    }
}
function loadModuleFromText(moduleCode) {
    const moduleFakePath = path_1.default.join(__dirname, 'externally-loaded.js');
    const sandbox = {
        require: require,
        module: {},
        console,
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval,
        setImmediate,
        clearImmediate,
    };
    vm_1.default.runInNewContext(moduleCode, sandbox, moduleFakePath);
    /* eslint-disable-line */ // @ts-ignore
    return sandbox.module.exports;
}
function loadModuleFromFile(modulePath) {
    const moduleCode = fs_1.default.readFileSync(modulePath, { encoding: 'utf8' });
    return loadModuleFromText(moduleCode);
}
function* getExternalConvertersDefinitions(settings) {
    const externalConverters = settings.external_converters;
    for (const moduleName of externalConverters) {
        let converter;
        if (moduleName.endsWith('.js')) {
            converter = loadModuleFromFile(data_1.default.joinPath(moduleName));
        }
        else {
            converter = require(moduleName);
        }
        if (Array.isArray(converter)) {
            for (const item of converter) {
                yield item;
            }
        }
        else {
            yield converter;
        }
    }
}
function removeNullPropertiesFromObject(obj) {
    for (const key of Object.keys(obj)) {
        const value = obj[key];
        if (value == null) {
            delete obj[key];
        }
        else if (typeof value === 'object') {
            removeNullPropertiesFromObject(value);
        }
    }
}
function toNetworkAddressHex(value) {
    const hex = value.toString(16);
    return `0x${'0'.repeat(4 - hex.length)}${hex}`;
}
// eslint-disable-next-line
function toSnakeCase(value) {
    if (typeof value === 'object') {
        value = { ...value };
        for (const key of Object.keys(value)) {
            const keySnakeCase = toSnakeCase(key);
            if (key !== keySnakeCase) {
                value[keySnakeCase] = value[key];
                delete value[key];
            }
        }
        return value;
    }
    else {
        return value.replace(/\.?([A-Z])/g, (x, y) => '_' + y.toLowerCase()).replace(/^_/, '').replace('_i_d', '_id');
    }
}
function charRange(start, stop) {
    const result = [];
    for (let idx = start.charCodeAt(0), end = stop.charCodeAt(0); idx <= end; ++idx) {
        result.push(idx);
    }
    return result;
}
const controlCharacters = [
    ...charRange('\u0000', '\u001F'),
    ...charRange('\u007f', '\u009F'),
    ...charRange('\ufdd0', '\ufdef'),
];
function containsControlCharacter(str) {
    for (let i = 0; i < str.length; i++) {
        const ch = str.charCodeAt(i);
        if (controlCharacters.includes(ch) || [0xFFFE, 0xFFFF].includes(ch & 0xFFFF)) {
            return true;
        }
    }
    return false;
}
function getAllFiles(path_) {
    const result = [];
    for (let item of fs_1.default.readdirSync(path_)) {
        item = path_1.default.join(path_, item);
        if (fs_1.default.lstatSync(item).isFile()) {
            result.push(item);
        }
        else {
            result.push(...getAllFiles(item));
        }
    }
    return result;
}
function validateFriendlyName(name, throwFirstError = false) {
    const errors = [];
    for (const endpointName of endpointNames) {
        if (name.toLowerCase().endsWith('/' + endpointName)) {
            errors.push(`friendly_name is not allowed to end with: '/${endpointName}'`);
        }
    }
    if (name.length === 0)
        errors.push(`friendly_name must be at least 1 char long`);
    if (name.endsWith('/') || name.startsWith('/'))
        errors.push(`friendly_name is not allowed to end or start with /`);
    if (containsControlCharacter(name))
        errors.push(`friendly_name is not allowed to contain control char`);
    if (endpointNames.includes(name))
        errors.push(`Following friendly_name are not allowed: '${endpointNames}'`);
    if (name.match(/.*\/\d*$/))
        errors.push(`Friendly name cannot end with a "/DIGIT" ('${name}')`);
    if (name.includes('#') || name.includes('+')) {
        errors.push(`MQTT wildcard (+ and #) not allowed in friendly_name ('${name}')`);
    }
    if (throwFirstError && errors.length) {
        throw new Error(errors[0]);
    }
    return errors;
}
function sleep(seconds) {
    return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}
function sanitizeImageParameter(parameter) {
    const replaceByDash = [/\?/g, /&/g, /[^a-z\d\- _./:]/gi];
    let sanitized = parameter;
    replaceByDash.forEach((r) => sanitized = sanitized.replace(r, '-'));
    return sanitized;
}
function isAvailabilityEnabledForEntity(entity, settings) {
    if (entity.isGroup()) {
        return !entity.membersDevices().map((d) => isAvailabilityEnabledForEntity(d, settings)).includes(false);
    }
    if (entity.options.hasOwnProperty('availability')) {
        return !!entity.options.availability;
    }
    // availability_timeout = deprecated
    const enabledGlobal = settings.advanced.availability_timeout || settings.availability;
    if (!enabledGlobal)
        return false;
    const passlist = settings.advanced.availability_passlist.concat(settings.advanced.availability_whitelist);
    if (passlist.length > 0) {
        return passlist.includes(entity.name) || passlist.includes(entity.ieeeAddr);
    }
    const blocklist = settings.advanced.availability_blacklist.concat(settings.advanced.availability_blocklist);
    return !blocklist.includes(entity.name) && !blocklist.includes(entity.ieeeAddr);
}
const entityIDRegex = new RegExp(`^(.+?)(?:/(${endpointNames.join('|')}|\\d+))?$`);
function parseEntityID(ID) {
    const match = ID.match(entityIDRegex);
    return match && { ID: match[1], endpoint: match[2] };
}
function isEndpoint(obj) {
    return obj.constructor.name.toLowerCase() === 'endpoint';
}
function isZHGroup(obj) {
    return obj.constructor.name.toLowerCase() === 'group';
}
function availabilityPayload(state, settings) {
    return settings.advanced.legacy_availability_payload ? state : JSON.stringify({ state });
}
const hours = (hours) => 1000 * 60 * 60 * hours;
const minutes = (minutes) => 1000 * 60 * minutes;
const seconds = (seconds) => 1000 * seconds;
function publishLastSeen(data, settings, allowMessageEmitted, publishEntityState) {
    /**
     * Prevent 2 MQTT publishes when 1 message event is received;
     * - In case reason == messageEmitted, receive.ts will only call this when it did not publish a
     *      message based on the received zigbee message. In this case allowMessageEmitted has to be true.
     * - In case reason !== messageEmitted, controller.ts will call this based on the zigbee-herdsman
     *      lastSeenChanged event.
     */
    const allow = data.reason !== 'messageEmitted' || (data.reason === 'messageEmitted' && allowMessageEmitted);
    if (settings.advanced.last_seen && settings.advanced.last_seen !== 'disable' && allow) {
        publishEntityState(data.device, {}, 'lastSeenChanged');
    }
}
function filterProperties(filter, data) {
    if (filter) {
        for (const property of Object.keys(data)) {
            if (filter.find((p) => property.match(`^${p}$`))) {
                delete data[property];
            }
        }
    }
}
exports.default = {
    endpointNames, capitalize, getZigbee2MQTTVersion, getDependencyVersion, formatDate, objectHasProperties,
    equalsPartial, getObjectProperty, getResponse, parseJSON, loadModuleFromText, loadModuleFromFile,
    getExternalConvertersDefinitions, removeNullPropertiesFromObject, toNetworkAddressHex, toSnakeCase,
    parseEntityID, isEndpoint, isZHGroup, hours, minutes, seconds, validateFriendlyName, sleep,
    sanitizeImageParameter, isAvailabilityEnabledForEntity, publishLastSeen, availabilityPayload,
    getAllFiles, filterProperties,
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9saWIvdXRpbC91dGlscy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7QUFBQSw4REFBeUM7QUFDekMsMEVBQWlEO0FBQ2pELGtEQUEwQjtBQUMxQiw0Q0FBb0I7QUFDcEIsNENBQW9CO0FBQ3BCLGdEQUF3QjtBQUV4QiwwREFBMEQ7QUFDMUQsV0FBVztBQUNYLGtEQUFrRDtBQUNsRCx5RUFBeUU7QUFDekUsU0FBUyxnQkFBZ0IsQ0FBQyxJQUFVO0lBQ2hDLE1BQU0sUUFBUSxHQUFHLENBQUMsSUFBSSxDQUFDLGlCQUFpQixFQUFFLENBQUM7SUFDM0MsTUFBTSxXQUFXLEdBQUcsUUFBUSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUM7SUFDOUMsTUFBTSxHQUFHLEdBQUcsQ0FBQyxHQUFXLEVBQVUsRUFBRTtRQUNoQyxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUN2QyxPQUFPLENBQUMsSUFBSSxHQUFHLEVBQUUsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUM7SUFDekMsQ0FBQyxDQUFDO0lBRUYsT0FBTyxJQUFJLENBQUMsV0FBVyxFQUFFO1FBQ3JCLEdBQUcsR0FBRyxHQUFHLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxHQUFHLENBQUMsQ0FBQztRQUM5QixHQUFHLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUN6QixHQUFHLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztRQUMxQixHQUFHLEdBQUcsR0FBRyxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQztRQUM1QixHQUFHLEdBQUcsR0FB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