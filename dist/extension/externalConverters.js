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
const zigbee_herdsman_converters_1 = __importDefault(require("zigbee-herdsman-converters"));
const settings = __importStar(require("../util/settings"));
const utils_1 = __importDefault(require("../util/utils"));
const extension_1 = __importDefault(require("./extension"));
class ExternalConverters extends extension_1.default {
    constructor(zigbee, mqtt, state, publishEntityState, eventBus, enableDisableExtension, restartCallback, addExtension) {
        super(zigbee, mqtt, state, publishEntityState, eventBus, enableDisableExtension, restartCallback, addExtension);
        for (const definition of utils_1.default.getExternalConvertersDefinitions(settings.get())) {
            const toAdd = { ...definition };
            delete toAdd['homeassistant'];
            zigbee_herdsman_converters_1.default.addDeviceDefinition(toAdd);
        }
    }
}
exports.default = ExternalConverters;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXh0ZXJuYWxDb252ZXJ0ZXJzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vbGliL2V4dGVuc2lvbi9leHRlcm5hbENvbnZlcnRlcnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7O0FBQUEsNEZBQTZDO0FBQzdDLDJEQUE2QztBQUM3QywwREFBa0M7QUFDbEMsNERBQW9DO0FBRXBDLE1BQXFCLGtCQUFtQixTQUFRLG1CQUFTO0lBQ3JELFlBQVksTUFBYyxFQUFFLElBQVUsRUFBRSxLQUFZLEVBQUUsa0JBQXNDLEVBQ3hGLFFBQWtCLEVBQUUsc0JBQXdFLEVBQzVGLGVBQTJCLEVBQUUsWUFBcUQ7UUFDbEYsS0FBSyxDQUFDLE1BQU0sRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLGtCQUFrQixFQUFFLFFBQVEsRUFBRSxzQkFBc0IsRUFBRSxlQUFlLEVBQUUsWUFBWSxDQUFDLENBQUM7UUFFaEgsS0FBSyxNQUFNLFVBQVUsSUFBSSxlQUFLLENBQUMsZ0NBQWdDLENBQUMsUUFBUSxDQUFDLEdBQUcsRUFBRSxDQUFDLEVBQUU7WUFDN0UsTUFBTSxLQUFLLEdBQUcsRUFBQyxHQUFHLFVBQVUsRUFBQyxDQUFDO1lBQzlCLE9BQU8sS0FBSyxDQUFDLGVBQWUsQ0FBQyxDQUFDO1lBQzlCLG9DQUFHLENBQUMsbUJBQW1CLENBQUMsS0FBSyxDQUFDLENBQUM7U0FDbEM7SUFDTCxDQUFDO0NBQ0o7QUFaRCxxQ0FZQyJ9