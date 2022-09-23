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
const winston_1 = __importDefault(require("winston"));
const moment_1 = __importDefault(require("moment"));
const settings = __importStar(require("./settings"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const mkdir_recursive_1 = __importDefault(require("mkdir-recursive"));
const rimraf_1 = __importDefault(require("rimraf"));
const assert_1 = __importDefault(require("assert"));
const colorizer = winston_1.default.format.colorize();
const z2mToWinstonLevel = (level) => level === 'warn' ? 'warning' : level;
const winstonToZ2mLevel = (level) => level === 'warning' ? 'warn' : level;
const levelWithCompensatedLength = {
    'info': 'info ',
    'error': 'error',
    'warn': 'warn ',
    'debug': 'debug',
};
let logger;
let fileTransport;
let output;
let directory;
let logFilename;
let transportsToUse;
function init() {
    // What transports to enable
    output = settings.get().advanced.log_output;
    // Directory to log to
    const timestamp = moment_1.default(Date.now()).format('YYYY-MM-DD.HH-mm-ss');
    directory = settings.get().advanced.log_directory.replace('%TIMESTAMP%', timestamp);
    logFilename = settings.get().advanced.log_file.replace('%TIMESTAMP%', timestamp);
    // Make sure that log directoy exsists when not logging to stdout only
    if (output.includes('file')) {
        mkdir_recursive_1.default.mkdirSync(directory);
        if (settings.get().advanced.log_symlink_current) {
            const current = settings.get().advanced.log_directory.replace('%TIMESTAMP%', 'current');
            const actual = './' + timestamp;
            /* istanbul ignore next */
            if (fs_1.default.existsSync(current)) {
                fs_1.default.unlinkSync(current);
            }
            fs_1.default.symlinkSync(actual, current);
        }
    }
    // Determine the log level.
    const z2mLevel = settings.get().advanced.log_level;
    const validLevels = ['info', 'error', 'warn', 'debug'];
    assert_1.default(validLevels.includes(z2mLevel), `'${z2mLevel}' is not valid log_level, use one of '${validLevels.join(', ')}'`);
    const level = z2mToWinstonLevel(z2mLevel);
    const timestampFormat = () => moment_1.default().format(settings.get().advanced.timestamp_format);
    // Setup default console logger
    transportsToUse = [
        new winston_1.default.transports.Console({
            level,
            silent: !output.includes('console'),
            format: winston_1.default.format.combine(winston_1.default.format.timestamp({ format: timestampFormat }), winston_1.default.format.printf(/* istanbul ignore next */ (info) => {
                const { timestamp, level, message } = info;
                const l = winstonToZ2mLevel(level);
                const plainPrefix = `Zigbee2MQTT:${levelWithCompensatedLength[l]}`;
                let prefix = plainPrefix;
                if (process.stdout.isTTY) {
                    prefix = colorizer.colorize(l, plainPrefix);
                }
                return `${prefix} ${timestamp.split('.')[0]}: ${message}`;
            })),
        }),
    ];
    // Add file logger when enabled
    // NOTE: the initiation of the logger, even when not added as transport tries to create the logging directory
    const transportFileOptions = {
        filename: path_1.default.join(directory, logFilename),
        json: false,
        level,
        format: winston_1.default.format.combine(winston_1.default.format.timestamp({ format: timestampFormat }), winston_1.default.format.printf(/* istanbul ignore next */ (info) => {
            const { timestamp, level, message } = info;
            const l = winstonToZ2mLevel(level);
            return `${levelWithCompensatedLength[l]} ${timestamp.split('.')[0]}: ${message}`;
        })),
    };
    if (settings.get().advanced.log_rotation) {
        transportFileOptions.tailable = true;
        transportFileOptions.maxFiles = 3; // Keep last 3 files
        transportFileOptions.maxsize = 10000000; // 10MB
    }
    if (output.includes('file')) {
        fileTransport = new winston_1.default.transports.File(transportFileOptions);
        transportsToUse.push(fileTransport);
    }
    /* istanbul ignore next */
    if (output.includes('syslog')) {
        // eslint-disable-next-line
        require('winston-syslog').Syslog;
        const options = {
            app_name: 'Zigbee2MQTT',
            format: winston_1.default.format.printf(/* istanbul ignore next */ (info) => {
                return `${info.message}`;
            }),
            ...settings.get().advanced.log_syslog,
        };
        if (options.hasOwnProperty('type'))
            options.type = options.type.toString();
        // @ts-ignore
        transportsToUse.push(new winston_1.default.transports.Syslog(options));
    }
    logger = winston_1.default.createLogger({ transports: transportsToUse, levels: winston_1.default.config.syslog.levels });
}
// Cleanup any old log directory.
function cleanup() {
    if (settings.get().advanced.log_directory.includes('%TIMESTAMP%')) {
        const rootDirectory = path_1.default.join(directory, '..');
        let directories = fs_1.default.readdirSync(rootDirectory).map((d) => {
            d = path_1.default.join(rootDirectory, d);
            return { path: d, birth: fs_1.default.statSync(d).mtime };
        });
        directories.sort((a, b) => b.birth - a.birth);
        directories = directories.slice(10, directories.length);
        directories.forEach((dir) => {
            logger.debug(`Removing old log directory '${dir.path}'`);
            rimraf_1.default.sync(dir.path);
        });
    }
}
// Print to user what logging is enabled
function logOutput() {
    if (output.includes('file')) {
        if (output.includes('console')) {
            logger.info(`Logging to console and directory: '${directory}' filename: ${logFilename}`);
        }
        else {
            logger.info(`Logging to directory: '${directory}' filename: ${logFilename}`);
        }
        cleanup();
    }
    else if (output.includes('console')) {
        logger.info(`Logging to console only'`);
    }
}
function addTransport(transport) {
    transport.level = transportsToUse[0].level;
    logger.add(transport);
}
function getLevel() {
    return winstonToZ2mLevel(transportsToUse[0].level);
}
function setLevel(level) {
    logger.transports.forEach((transport) => transport.level = z2mToWinstonLevel(level));
}
function warn(message) {
    // winston.config.syslog.levels doesnt have warn, but is required for syslog.
    logger.warning(message);
}
function warning(message) {
    logger.warning(message);
}
function info(message) {
    logger.info(message);
}
function debug(message) {
    logger.debug(message);
}
function error(message) {
    logger.error(message);
}
// Workaround for https://github.com/winstonjs/winston/issues/1629.
// https://github.com/Koenkk/zigbee2mqtt/pull/10905
/* istanbul ignore next */
async function end() {
    logger.end();
    await new Promise((resolve) => {
        if (!fileTransport) {
            process.nextTick(resolve);
        }
        else {
            // @ts-ignore
            if (fileTransport._dest) {
                // @ts-ignore
                fileTransport._dest.on('finish', resolve);
            }
            else {
                // @ts-ignore
                fileTransport.on('open', () => fileTransport._dest.on('finish', resolve));
            }
        }
    });
}
exports.default = {
    init, logOutput, warn, warning, error, info, debug, setLevel, getLevel, cleanup, addTransport, end,
    winston: () => logger,
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG9nZ2VyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vbGliL3V0aWwvbG9nZ2VyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7OztBQUFBLHNEQUE4QjtBQUM5QixvREFBNEI7QUFDNUIscURBQXVDO0FBQ3ZDLGdEQUF3QjtBQUN4Qiw0Q0FBb0I7QUFDcEIsc0VBQWlDO0FBQ2pDLG9EQUE0QjtBQUM1QixvREFBNEI7QUFFNUIsTUFBTSxTQUFTLEdBQUcsaUJBQU8sQ0FBQyxNQUFNLENBQUMsUUFBUSxFQUFFLENBQUM7QUFLNUMsTUFBTSxpQkFBaUIsR0FBRyxDQUFDLEtBQWtCLEVBQW1CLEVBQUUsQ0FBQyxLQUFLLEtBQUssTUFBTSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQztBQUN4RyxNQUFNLGlCQUFpQixHQUFHLENBQUMsS0FBc0IsRUFBZSxFQUFFLENBQUMsS0FBSyxLQUFLLFNBQVMsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUM7QUFFeEcsTUFBTSwwQkFBMEIsR0FBMEI7SUFDdEQsTUFBTSxFQUFFLE9BQU87SUFDZixPQUFPLEVBQUUsT0FBTztJQUNoQixNQUFNLEVBQUUsT0FBTztJQUNmLE9BQU8sRUFBRSxPQUFPO0NBQ25CLENBQUM7QUFFRixJQUFJLE1BQXNCLENBQUM7QUFDM0IsSUFBSSxhQUFpQyxDQUFDO0FBQ3RDLElBQUksTUFBZ0IsQ0FBQztBQUNyQixJQUFJLFNBQWlCLENBQUM7QUFDdEIsSUFBSSxXQUFtQixDQUFDO0FBQ3hCLElBQUksZUFBb0MsQ0FBQztBQUV6QyxTQUFTLElBQUk7SUFDVCw0QkFBNEI7SUFDNUIsTUFBTSxHQUFHLFFBQVEsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxRQUFRLENBQUMsVUFBVSxDQUFDO0lBRTVDLHNCQUFzQjtJQUN0QixNQUFNLFNBQVMsR0FBRyxnQkFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLEVB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