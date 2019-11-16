export {default} from './lib/client';
export {default as Server} from './lib/server';
export {default as Session} from './lib/session';
export {default as Message} from './lib/message';
export {default as Property, PropType, props} from './lib/property';
export {PropName, PropTypes} from './lib/properties';

export {default as CFLBinaryPList} from './lib/cflbinary';
import * as Firmware from './lib/firmware';
export {Firmware};

export enum LogLevel {
    NONE = 0,
    WARNING = 2,
    INFO = 4,
    DEBUG = 7,
}

export let loglevel: LogLevel = LogLevel.NONE;
