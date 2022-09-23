"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = __importDefault(require("path"));
let dataPath = null;
function load() {
    if (process.env.ZIGBEE2MQTT_DATA) {
        dataPath = process.env.ZIGBEE2MQTT_DATA;
    }
    else {
        dataPath = path_1.default.join(__dirname, '..', '..', 'data');
        dataPath = path_1.default.normalize(dataPath);
    }
}
load();
function joinPath(file) {
    return path_1.default.join(dataPath, file);
}
function getPath() {
    return dataPath;
}
// eslint-disable-next-line camelcase
function testingOnlyReload() {
    load();
}
exports.default = { joinPath, getPath, testingOnlyReload };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGF0YS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL2xpYi91dGlsL2RhdGEudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBQSxnREFBd0I7QUFFeEIsSUFBSSxRQUFRLEdBQVcsSUFBSSxDQUFDO0FBRTVCLFNBQVMsSUFBSTtJQUNULElBQUksT0FBTyxDQUFDLEdBQUcsQ0FBQyxnQkFBZ0IsRUFBRTtRQUM5QixRQUFRLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxnQkFBZ0IsQ0FBQztLQUMzQztTQUFNO1FBQ0gsUUFBUSxHQUFHLGNBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFDcEQsUUFBUSxHQUFHLGNBQUksQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLENBQUM7S0FDdkM7QUFDTCxDQUFDO0FBRUQsSUFBSSxFQUFFLENBQUM7QUFFUCxTQUFTLFFBQVEsQ0FBQyxJQUFZO0lBQzFCLE9BQU8sY0FBSSxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLENBQUM7QUFDckMsQ0FBQztBQUVELFNBQVMsT0FBTztJQUNaLE9BQU8sUUFBUSxDQUFDO0FBQ3BCLENBQUM7QUFFRCxxQ0FBcUM7QUFDckMsU0FBUyxpQkFBaUI7SUFDdEIsSUFBSSxFQUFFLENBQUM7QUFDWCxDQUFDO0FBRUQsa0JBQWUsRUFBQyxRQUFRLEVBQUUsT0FBTyxFQUFFLGlCQUFpQixFQUFDLENBQUMifQ==