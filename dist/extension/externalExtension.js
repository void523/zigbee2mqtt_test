"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const settings = __importStar(require("../util/settings"));
const utils_1 = __importDefault(require("../util/utils"));
const fs_1 = __importDefault(require("fs"));
const data_1 = __importDefault(require("./../util/data"));
const path_1 = __importDefault(require("path"));
const logger_1 = __importDefault(require("./../util/logger"));
const json_stable_stringify_without_jsonify_1 = __importDefault(require("json-stable-stringify-without-jsonify"));
const bind_decorator_1 = __importDefault(require("bind-decorator"));
const extension_1 = __importDefault(require("./extension"));
const requestRegex = new RegExp(`${settings.get().mqtt.base_topic}/bridge/request/extension/(save|remove)`);
class ExternalExtension extends extension_1.default {
    async start() {
        this.eventBus.onMQTTMessage(this, this.onMQTTMessage);
        this.requestLookup = { 'save': this.saveExtension, 'remove': this.removeExtension };
        this.loadUserDefinedExtensions();
        await this.publishExtensions();
    }
    getExtensionsBasePath() {
        return data_1.default.joinPath('extension');
    }
    getListOfUserDefinedExtensions() {
        const basePath = this.getExtensionsBasePath();
        if (fs_1.default.existsSync(basePath)) {
            return fs_1.default.readdirSync(basePath).filter((f) => f.endsWith('.js')).map((fileName) => {
                const extensonFilePath = path_1.default.join(basePath, fileName);
                return { 'name': fileName, 'code': fs_1.default.readFileSync(extensonFilePath, 'utf-8') };
            });
        }
        else {
            return [];
        }
    }
    async removeExtension(message) {
        const { name } = message;
        const extensions = this.getListOfUserDefinedExtensions();
        const extensionToBeRemoved = extensions.find((e) => e.name === name);
        if (extensionToBeRemoved) {
            await this.enableDisableExtension(false, extensionToBeRemoved.name);
            const basePath = this.getExtensionsBasePath();
            const extensionFilePath = path_1.default.join(basePath, path_1.default.basename(name));
            fs_1.default.unlinkSync(extensionFilePath);
            this.publishExtensions();
            logger_1.default.info(`Extension ${name} removed`);
            return utils_1.default.getResponse(message, {}, null);
        }
        else {
            return utils_1.default.getResponse(message, {}, `Extension ${name} doesn't exists`);
        }
    }
    async saveExtension(message) {
        const { name, code } = message;
        const ModuleConstructor = utils_1.default.loadModuleFromText(code);
        await this.loadExtension(ModuleConstructor);
        const basePath = this.getExtensionsBasePath();
        /* istanbul ignore else */
        if (!fs_1.default.existsSync(basePath)) {
            fs_1.default.mkdirSync(basePath);
        }
        const extensonFilePath = path_1.default.join(basePath, path_1.default.basename(name));
        fs_1.default.writeFileSync(extensonFilePath, code);
        this.publishExtensions();
        logger_1.default.info(`Extension ${name} loaded`);
        return utils_1.default.getResponse(message, {}, null);
    }
    async onMQTTMessage(data) {
        const match = data.topic.match(requestRegex);
        if (match && this.requestLookup[match[1].toLowerCase()]) {
            const message = utils_1.default.parseJSON(data.message, data.message);
            try {
                const response = await this.requestLookup[match[1].toLowerCase()](message);
                await this.mqtt.publish(`bridge/response/extension/${match[1]}`, json_stable_stringify_without_jsonify_1.default(response));
            }
            catch (error) {
                logger_1.default.error(`Request '${data.topic}' failed with error: '${error.message}'`);
                const response = utils_1.default.getResponse(message, {}, error.message);
                await this.mqtt.publish(`bridge/response/extension/${match[1]}`, json_stable_stringify_without_jsonify_1.default(response));
            }
        }
    }
    async loadExtension(ConstructorClass) {
        await this.enableDisableExtension(false, ConstructorClass.name);
        // @ts-ignore
        await this.addExtension(new ConstructorClass(this.zigbee, this.mqtt, this.state, this.publishEntityState, this.eventBus, settings, logger_1.default));
    }
    loadUserDefinedExtensions() {
        const extensions = this.getListOfUserDefinedExtensions();
        extensions
            .map(({ code }) => utils_1.default.loadModuleFromText(code))
            .map(this.loadExtension);
    }
    async publishExtensions() {
        const extensions = this.getListOfUserDefinedExtensions();
        await this.mqtt.publish('bridge/extensions', json_stable_stringify_without_jsonify_1.default(extensions), {
            retain: true,
            qos: 0,
        }, settings.get().mqtt.base_topic, true);
    }
}
__decorate([
    bind_decorator_1.default
], ExternalExtension.prototype, "removeExtension", null);
__decorate([
    bind_decorator_1.default
], ExternalExtension.prototype, "saveExtension", null);
__decorate([
    bind_decorator_1.default
], ExternalExtension.prototype, "onMQTTMessage", null);
__decorate([
    bind_decorator_1.default
], ExternalExtension.prototype, "loadExtension", null);
exports.default = ExternalExtension;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0ZXJuYWxFeHRlbnNpb24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9saWIvZXh0ZW5zaW9uL2V4dGVybmFsRXh0ZW5zaW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLDJEQUE2QztBQUM3QywwREFBa0M7QUFDbEMsNENBQW9CO0FBQ3BCLDBEQUFrQztBQUNsQyxnREFBd0I7QUFDeEIsOERBQXNDO0FBQ3RDLGtIQUE4RDtBQUM5RCxvRUFBa0M7QUFDbEMsNERBQW9DO0FBRXBDLE1BQU0sWUFBWSxHQUFHLElBQUksTUFBTSxDQUFDLEdBQUcsUUFBUSxDQUFDLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxVQUFVLHlDQUF5QyxDQUFDLENBQUM7QUFFNUcsTUFBcUIsaUJBQWtCLFNBQVEsbUJBQVM7SUFHM0MsS0FBSyxDQUFDLEtBQUs7UUFDaEIsSUFBSSxDQUFDLFFBQVEsQ0FBQyxhQUFhLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQztRQUN0RCxJQUFJLENBQUMsYUFBYSxHQUFHLEVBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxhQUFhLEVBQUUsUUFBUSxFQUFFLElBQUksQ0FBQyxlQUFlLEVBQUMsQ0FBQztRQUNsRixJQUFJLENBQUMseUJBQXlCLEVBQUUsQ0FBQztRQUNqQyxNQUFNLElBQUksQ0FBQyxpQkFBaUIsRUFBRSxDQUFDO0lBQ25DLENBQUM7SUFFTyxxQkFBcUI7UUFDekIsT0FBTyxjQUFJLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQyxDQUFDO0lBQ3RDLENBQUM7SUFFTyw4QkFBOEI7UUFDbEMsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLHFCQUFxQixFQUFFLENBQUM7UUFDOUMsSUFBSSxZQUFFLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxFQUFFO1lBQ3pCLE9BQU8sWUFBRSxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsQ0FBQyxNQUFNLENBQUMs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