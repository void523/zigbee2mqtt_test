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
const logger_1 = __importDefault(require("./util/logger"));
const data_1 = __importDefault(require("./util/data"));
const settings = __importStar(require("./util/settings"));
const utils_1 = __importDefault(require("./util/utils"));
const fs_1 = __importDefault(require("fs"));
const object_assign_deep_1 = __importDefault(require("object-assign-deep"));
const saveInterval = 1000 * 60 * 5; // 5 minutes
const dontCacheProperties = [
    'action', 'action_.*', 'button', 'button_left', 'button_right', 'click', 'forgotten', 'keyerror',
    'step_size', 'transition_time', 'group_list', 'group_capacity', 'no_occupancy_since',
    'step_mode', 'transition_time', 'duration', 'elapsed', 'from_side', 'to_side',
];
class State {
    constructor(eventBus) {
        this.state = {};
        this.file = data_1.default.joinPath('state.json');
        this.timer = null;
        this.eventBus = eventBus;
    }
    start() {
        this.load();
        // Save the state on every interval
        this.timer = setInterval(() => this.save(), saveInterval);
        this.eventBus.onDeviceLeave(this, (data) => delete this.state[data.ieeeAddr]);
    }
    stop() {
        this.eventBus.removeListeners(this);
        clearTimeout(this.timer);
        this.save();
    }
    load() {
        if (fs_1.default.existsSync(this.file)) {
            try {
                this.state = JSON.parse(fs_1.default.readFileSync(this.file, 'utf8'));
                logger_1.default.debug(`Loaded state from file ${this.file}`);
            }
            catch (e) {
                logger_1.default.debug(`Failed to load state from file ${this.file} (corrupt file?)`);
            }
        }
        else {
            logger_1.default.debug(`Can't load state from file ${this.file} (doesn't exist)`);
        }
    }
    save() {
        if (settings.get().advanced.cache_state_persistent) {
            logger_1.default.debug(`Saving state to file ${this.file}`);
            const json = JSON.stringify(this.state, null, 4);
            try {
                fs_1.default.writeFileSync(this.file, json, 'utf8');
            }
            catch (e) {
                logger_1.default.error(`Failed to write state to '${this.file}' (${e.message})`);
            }
        }
        else {
            logger_1.default.debug(`Not saving state`);
        }
    }
    exists(entity) {
        return this.state.hasOwnProperty(entity.ID);
    }
    get(entity) {
        return this.state[entity.ID] || {};
    }
    set(entity, update, reason = null) {
        const fromState = this.state[entity.ID] || {};
        const toState = object_assign_deep_1.default({}, fromState, update);
        const newCache = { ...toState };
        const entityDontCacheProperties = entity.options.filtered_cache || [];
        utils_1.default.filterProperties(dontCacheProperties.concat(entityDontCacheProperties), newCache);
        this.state[entity.ID] = newCache;
        this.eventBus.emitStateChange({ entity, from: fromState, to: toState, reason, update });
        return toState;
    }
    remove(ID) {
        delete this.state[ID];
    }
}
exports.default = State;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhdGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9saWIvc3RhdGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7O0FBQUEsMkRBQW1DO0FBQ25DLHVEQUErQjtBQUMvQiwwREFBNEM7QUFDNUMseURBQWlDO0FBQ2pDLDRDQUFvQjtBQUNwQiw0RUFBa0Q7QUFFbEQsTUFBTSxZQUFZLEdBQUcsSUFBSSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQyxZQUFZO0FBRWhELE1BQU0sbUJBQW1CLEdBQUc7SUFDeEIsUUFBUSxFQUFFLFdBQVcsRUFBRSxRQUFRLEVBQUUsYUFBYSxFQUFFLGNBQWMsRUFBRSxPQUFPLEVBQUUsV0FBVyxFQUFFLFVBQVU7SUFDaEcsV0FBVyxFQUFFLGlCQUFpQixFQUFFLFlBQVksRUFBRSxnQkFBZ0IsRUFBRSxvQkFBb0I7SUFDcEYsV0FBVyxFQUFFLGlCQUFpQixFQUFFLFVBQVUsRUFBRSxTQUFTLEVBQUUsV0FBVyxFQUFFLFNBQVM7Q0FDaEYsQ0FBQztBQUVGLE1BQU0sS0FBSztJQU1QLFlBQVksUUFBa0I7UUFMdEIsVUFBSyxHQUFxQyxFQUFFLENBQUM7UUFDN0MsU0FBSSxHQUFHLGNBQUksQ0FBQyxRQUFRLENBQUMsWUFBWSxDQUFDLENBQUM7UUFDbkMsVUFBSyxHQUFpQixJQUFJLENBQUM7UUFJL0IsSUFBSSxDQUFDLFFBQVEsR0FBRyxRQUFRLENBQUM7SUFDN0IsQ0FBQztJQUVELEtBQUs7UUFDRCxJQUFJLENBQUMsSUFBSSxFQUFFLENBQUM7UUFFWixtQ0FBbUM7UUFDbkMsSUFBSSxDQUFDLEtBQUssR0FBRyxXQUFXLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxFQUFFLFlBQVksQ0FBQyxDQUFDO1FBQzFELElBQUksQ0FBQyxRQUFRLENBQUMsYUFBYSxDQUFDLElBQUksRUFBRSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsT0FBTyxJQUFJLENBQUMsS0FB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