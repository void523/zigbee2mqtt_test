"use strict";
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
// DEPRECATED
const settings = __importStar(require("../../util/settings"));
const logger_1 = __importDefault(require("../../util/logger"));
const utils_1 = __importDefault(require("../../util/utils"));
const extension_1 = __importDefault(require("../extension"));
/**
 * This extensions soft resets the ZNP after a certain timeout.
 */
class SoftReset extends extension_1.default {
    constructor() {
        super(...arguments);
        this.timer = null;
        this.timeout = utils_1.default.seconds(settings.get().advanced.soft_reset_timeout);
    }
    async start() {
        logger_1.default.debug(`Soft reset timeout set to ${this.timeout / 1000} seconds`);
        this.resetTimer();
        this.eventBus.onDeviceMessage(this, () => this.resetTimer());
        this.eventBus.onDeviceAnnounce(this, () => this.resetTimer());
        this.eventBus.onDeviceNetworkAddressChanged(this, () => this.resetTimer());
        this.eventBus.onDeviceJoined(this, () => this.resetTimer());
        this.eventBus.onDeviceInterview(this, () => this.resetTimer());
    }
    clearTimer() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }
    resetTimer() {
        if (this.timeout === 0) {
            return;
        }
        this.clearTimer();
        this.timer = setTimeout(() => this.handleTimeout(), this.timeout);
    }
    async handleTimeout() {
        logger_1.default.warn('Soft reset timeout triggered');
        try {
            await this.zigbee.reset('soft');
            logger_1.default.warn('Soft resetted ZNP due to timeout');
        }
        catch (error) {
            logger_1.default.warn('Soft reset failed, trying stop/start');
            await this.zigbee.stop();
            logger_1.default.warn('Zigbee stopped');
            try {
                await this.zigbee.start();
            }
            catch (error) {
                logger_1.default.error('Failed to restart!');
            }
        }
        this.resetTimer();
    }
}
exports.default = SoftReset;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic29mdFJlc2V0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vbGliL2V4dGVuc2lvbi9sZWdhY3kvc29mdFJlc2V0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7OztBQUFBLDBCQUEwQjtBQUMxQixhQUFhO0FBQ2IsOERBQWdEO0FBQ2hELCtEQUF1QztBQUN2Qyw2REFBcUM7QUFDckMsNkRBQXFDO0FBRXJDOztHQUVHO0FBQ0gsTUFBcUIsU0FBVSxTQUFRLG1CQUFTO0lBQWhEOztRQUNZLFVBQUssR0FBaUIsSUFBSSxDQUFDO1FBQzNCLFlBQU8sR0FBRyxlQUFLLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxRQUFRLENBQUMsa0JBQWtCLENBQUMsQ0FBQztJQWlEaEYsQ0FBQztJQS9DWSxLQUFLLENBQUMsS0FBSztRQUNoQixnQkFBTSxDQUFDLEtBQUssQ0FBQyw2QkFBNkIsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLFVBQVUsQ0FBQyxDQUFDO1FBQ3pFLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQztRQUNsQixJQUFJLENBQUMsUUFBUSxDQUFDLGVBQWUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUM7UUFDN0QsSUFBSSxDQUFDLFFBQVEsQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLEVBQUUsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUM7UUFDOUQsSUFBSSxDQUFDLFFBQVEsQ0FBQyw2QkFBNkIsQ0FBQyxJQUFJLEVBQUUsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUM7UUFDM0UsSUFBSSxDQUFDLFFBQVEsQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFDO1FBQzVELElBQUksQ0FBQyxRQUFRLENBQUMsaUJBQWlCLENBQUMsSUFBSSxFQUFFLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQyxDQUFDO0lBQ25FLENBQUM7SUFFTyxVQUFVO1FBQ2QsSUFBSSxJQUFJLENBQUMsS0FBSyxFQUFFO1lBQ1osWUFBWSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUN6QixJQUFJLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQztTQUNyQjtJQUNMLENBQUM7SUFFTyxVQUFVO1FBQ2QsSUFBSSxJQUFJLENBQUMsT0FBTyxLQUFLLENBQUMsRUFBRTtZQUNwQixPQUFPO1NBQ1Y7UUFFRCxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUM7UUFDbEIsSUFBSSxDQUFDLEtBQUssR0FBRyxVQUFVLENBQUMsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLGFBQWEsRUFBRSxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUN0RSxDQUFDO0lBRU8sS0FBSyxDQUFDLGFBQWE7UUFDdkIsZ0JBQU0sQ0FBQyxJQUFJLENBQUMsOEJBQThCLENBQUMsQ0FBQztRQUU1QyxJQUFJO1lBQ0EsTUFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUNoQyxnQkFBTSxDQUFDLElBQUksQ0FBQyxrQ0FBa0MsQ0FBQyxDQUFDO1NBQ25EO1FBQUMsT0FBTyxLQUFLLEVBQUU7WUFDWixnQkFBTSxDQUFDLElBQUksQ0FBQyxzQ0FBc0MsQ0FBQyxDQUFDO1lBRXBELE1BQU0sSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLEVBQUUsQ0FBQztZQUN6QixnQkFBTSxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO1lBRTlCLElBQUk7Z0JBQ0EsTUFBTSxJQUFJLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRSxDQUFDO2FBQzdCO1lBQUMsT0FBTyxLQUFLLEVBQUU7Z0JBQ1osZ0JBQU0sQ0FBQyxLQUFLLENBQUMsb0JBQW9CLENBQUMsQ0FBQzthQUN0QztTQUNKO1FBRUQsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO0lBQ3RCLENBQUM7Q0FDSjtBQW5ERCw0QkFtREMifQ==