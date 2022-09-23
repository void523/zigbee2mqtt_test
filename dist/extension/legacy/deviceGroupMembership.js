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
/* istanbul ignore file */
const settings = __importStar(require("../../util/settings"));
const logger_1 = __importDefault(require("../../util/logger"));
const utils_1 = __importDefault(require("../../util/utils"));
const extension_1 = __importDefault(require("../extension"));
const bind_decorator_1 = __importDefault(require("bind-decorator"));
const device_1 = __importDefault(require("../../model/device"));
const topicRegex = new RegExp(`^${settings.get().mqtt.base_topic}/bridge/device/(.+)/get_group_membership$`);
class DeviceGroupMembership extends extension_1.default {
    async start() {
        this.eventBus.onMQTTMessage(this, this.onMQTTMessage);
    }
    async onMQTTMessage(data) {
        const match = data.topic.match(topicRegex);
        if (!match) {
            return null;
        }
        const parsed = utils_1.default.parseEntityID(match[1]);
        const device = this.zigbee.resolveEntity(parsed.ID);
        if (!device || !(device instanceof device_1.default)) {
            logger_1.default.error(`Device '${match[1]}' does not exist`);
            return;
        }
        const endpoint = device.endpoint(parsed.endpoint);
        const response = await endpoint.command(`genGroups`, 'getMembership', { groupcount: 0, grouplist: [] }, {});
        if (!response) {
            logger_1.default.warn(`Couldn't get group membership of ${device.ieeeAddr}`);
            return;
        }
        let { grouplist, capacity } = response;
        grouplist = grouplist.map((gid) => {
            const g = settings.getGroup(gid);
            return g ? g.friendly_name : gid;
        });
        const msgGroupList = `${device.ieeeAddr} is in groups [${grouplist}]`;
        let msgCapacity;
        if (capacity === 254) {
            msgCapacity = 'it can be a part of at least 1 more group';
        }
        else {
            msgCapacity = `its remaining group capacity is ${capacity === 255 ? 'unknown' : capacity}`;
        }
        logger_1.default.info(`${msgGroupList} and ${msgCapacity}`);
        this.publishEntityState(device, { group_list: grouplist, group_capacity: capacity });
    }
}
__decorate([
    bind_decorator_1.default
], DeviceGroupMembership.prototype, "onMQTTMessage", null);
exports.default = DeviceGroupMembership;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGV2aWNlR3JvdXBNZW1iZXJzaGlwLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vbGliL2V4dGVuc2lvbi9sZWdhY3kvZGV2aWNlR3JvdXBNZW1iZXJzaGlwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLDBCQUEwQjtBQUMxQiw4REFBZ0Q7QUFDaEQsK0RBQXVDO0FBQ3ZDLDZEQUFxQztBQUNyQyw2REFBcUM7QUFDckMsb0VBQWtDO0FBQ2xDLGdFQUF3QztBQUV4QyxNQUFNLFVBQVUsR0FBRyxJQUFJLE1BQU0sQ0FBQyxJQUFJLFFBQVEsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsVUFBVSwyQ0FBMkMsQ0FBQyxDQUFDO0FBRTdHLE1BQXFCLHFCQUFzQixTQUFRLG1CQUFTO0lBQy9DLEtBQUssQ0FBQyxLQUFLO1FBQ2hCLElBQUksQ0FBQyxRQUFRLENBQUMsYUFBYSxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUM7SUFDMUQsQ0FBQztJQUVLLEtBQUssQ0FBQyxhQUFhLENBQUMsSUFBMkI7UUFDakQsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDM0MsSUFBSSxDQUFDLEtBQUssRUFBRTtZQUNSLE9BQU8sSUFBSSxDQUFDO1NBQ2Y7UUFFRCxNQUFNLE1BQU0sR0FBRyxlQUFLLENBQUMsYUFBYSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQzdDLE1BQU0sTUFBTSxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQVcsQ0FBQztRQUM5RCxJQUFJLENBQUMsTUFBTSxJQUFJLENBQUMsQ0FBQyxNQUFNLFlBQVksZ0JBQU0sQ0FBQyxFQUFFO1lBQ3hDLGdCQUFNLENBQUMsS0FBSyxDQUFDLFdBQVcsS0FBSyxDQUFDLENBQUMsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO1lBQ3BELE9BQU87U0FDVjtRQUNELE1BQU0sUUFBUSxHQUFHLE1BQU0sQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQ2xELE1BQU0sUUFBUSxHQUFHLE1BQU0sUUFBUSxDQUFDLE9BQU8sQ0FDbkMsV0FBVyxFQUFFLGVBQWUsRUFBRSxFQUFDLFVBQVUsRUFBRSxDQUFDLEVBQUUsU0FBUyxFQUFFLEVBQUUsRUFBQyxFQUFFLEVBQUUsQ0FDbkUsQ0FBQztRQUVGLElBQUksQ0FBQyxRQUFRLEVBQUU7WUFDWCxnQkFBTSxDQUFDLElBQUksQ0FBQyxvQ0FBb0MsTUFBTSxDQUFDLFFBQVEsRUFBRSxDQUFDLENBQUM7WUFDbkUsT0FBTztTQUNWO1FBRUQsSUFBSSxFQUFDLFNBQVMsRUFBRSxRQUFRLEVBQUMsR0FBRyxRQUFRLENBQUM7UUFFckMsU0FBUyxHQUFHLFNBQVMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFXLEVBQUUsRUFBRTtZQUN0QyxNQUFNLENBQUMsR0FBRyxRQUFRLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQ2pDLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxHQUFHLENBQUM7UUFDckMsQ0FBQyxDQUFDLENBQUM7UUFFSCxNQUFNLFlBQVksR0FBRyxHQUFHLE1BQU0sQ0FBQyxRQUFRLGtCQUFrQixTQUFTLEdBQUcsQ0FBQztRQUN0RSxJQUFJLFdBQVcsQ0FBQztRQUNoQixJQUFJLFFBQVEsS0FBSyxHQUFHLEVBQUU7WUFDbEIsV0FBVyxHQUFHLDJDQUEyQyxDQUFDO1NBQzdEO2FBQU07WUFDSCxXQUFXLEdBQUcsbUNBQW1DLFFBQVEsS0FBSyxHQUFHLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxDQUFDLENBQUMsUUFBUSxFQUFFLENBQUM7U0FDOUY7UUFDRCxnQkFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLFlBQVksUUFBUSxXQUFXLEVBQUUsQ0FBQyxDQUFDO1FBRWxELElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxNQUFNLEVBQUUsRUFBQyxVQUFVLEVBQUUsU0FBUyxFQUFFLGNBQWMsRUFBRSxRQUFRLEVBQUMsQ0FBQyxDQUFDO0lBQ3ZGLENBQUM7Q0FDSjtBQXhDUztJQUFMLHdCQUFJOzBEQXVDSjtBQTVDTCx3Q0E2Q0MifQ==