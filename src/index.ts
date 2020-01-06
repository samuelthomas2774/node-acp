export {default, Monitor} from './lib/client';
export {default as Server} from './lib/server';
export {default as Session} from './lib/session';
export {default as Message, MessageType, ErrorCode} from './lib/message';
export {default as Property, PropType, props} from './lib/property';
export {PropName, PropTypes} from './lib/properties';

export {default as CFLBinaryPList} from './lib/cflbinary';
import * as Firmware from './lib/firmware';
import * as Util from './lib/util';
import * as PropertyValueTypes from './lib/property-types';
export {RPCInputData, RPCOutputData, RPCFunction, RPCInputs, RPCOutputs} from './lib/rpc-types';
export {Firmware, Util, PropertyValueTypes};

export enum LogLevel {
    NONE = 0,
    WARNING = 2,
    INFO = 4,
    DEBUG = 7,
}

export let loglevel: LogLevel = LogLevel.NONE;
