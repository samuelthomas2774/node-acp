import * as PropertyTypes from './property-types';

export interface RPCData<F extends RPCFunction = RPCFunction> {
    inputs: F extends keyof RPCInputs ? RPCInputs[F] : {[key: string]: any;};
    function: F;
}

export enum RPCFunction {
    // GET_INTERFACES = 'acpd.system.interfaces',
    RENEW_DHCP_LEASE = 'dhcp.client.lease.action',
    START_WPS = 'wsc.start', // flags 0x00000001
    AUTHORISE_WPS = 'wsc.authorize', // flags 0x00000001
    STOP_WPS = 'wsc.stop', // flags 0x00000001
    // VALIDATE_CONFIGURATION = 'acpd.parseDirtyPlist', // ??
    // UPDATE_CONFIGURATION = 'acpd.setDirtyPlist',

    UNKNOWN_INJECT_PACKET = 'acp.injectPacket',
    GET_RPC_FUNCTIONS = 'acprpc.show',
    GET_MONITOR_STATUS = 'acpmon.show',
    UNKNOWN_CHECK_FILE_SHARING_ACCESS = 'user.checkFileSharingAccess', // flags 0x00000001

    UNKNOWN_JOIN_REQUESTED = 'wsc.internal.joinRequested',
    UNKNOWN_JOIN_ABANDONED = 'wsc.internal.joinAbandoned',
    UNKNOWN_JOIN_SUCCEEDED = 'wsc.internal.joinSucceeded',
    UNKNOWN_JOIN_FAILED = 'wsc.internal.joinFailed',
    UNKNOWN_JOIN_EXPIRED = 'wsc.internal.joinExpired',
    UNKNOWN_WSC_DATA = 'wsc.internal.data',

    FLUSH_LOGS = 'syslogd.flush',

    GET_STATIC_CONFIG = 'acp.getStaticConfig',
    SET_STATIC_CONFIG = 'acp.setStaticConfig',
    SET_DYNAMIC_STORE_VALUE = 'acp.setDynamicStoreValue',

    UNKNOWN_BROWSE = 'remoteBonjour.browse',

    UNKNOWN_AP_STATUS = 'wifi.ap.status',
    UNKNOWN_STA_EVENT = 'wifi.sta.event',
    UNKNOWN_STA_STATUS = 'wifi.sta.status',
    UNKNOWN_WDS_STATUS = 'wifi.legacy.wds.status',
    UNKNOWN_WDS_LINK = 'wifi.legacy.wds.link',
    UNKNOWN_DWDS_JOIN = 'wifi.dwds.sta.join',
    UNKNOWN_DWDS_LEAVE = 'wifi.dwds.sta.leave',
    UNKNOWN_WDS_EXTENDER_STATUS = 'wifi.dynamic.wds.extender.status',
    UNKNOWN_CHANNEL_ANNOUNCE = 'wifi.channel.announce',
    UNKNOWN_PROXY_DISCOVERY = 'wifi.proxy.sta.discovery',
    UNKNOWN_PROXY_IDLE = 'wifi.proxy.sta.idle',
    UNKNOWN_PROXY_STATUS = 'wifi.proxysta.status',
    UNKNOWN_ANTENNA_CONFIG_GET = 'wifi.antenna.config.get',
    UNKNOWN_ANTENNA_CONFIG_SET = 'wifi.antenna.config.set',
    UNKNOWN_NOISE_GET = 'wifi.chain.noise.get',
    UNKNOWN_STATS_GET = 'wifi.interface.stats.get',
    UNKNOWN_SCAN_COMPLETE = 'wifi.scan.complete',
    UNKNOWN_SCAN_REQUEST = 'wifi.scan.request',
    UNKNOWN_WPS_CREDENTIALS = 'wifi.wps.credentials',

    UNKNOWN_MDNS_BTMM_USER = 'mdns.btmm.user', // flags 0x00000002
    UNKNOWN_MDNS_BTMM_CLEAR_USERS = 'mdns.btmm.clearAllUsers', // flags 0x00000002
    UNKNOWN_ICLOUD_MDNS_LHBAG = 'icloud.mdns.lhbag', // flags 0x00000002

    // CLOUD_UPDATE = 'cloud.update.', // + cloud UUID

    CHECK_CONNECTION = 'acpd.checkConnection',
    GET_SYSTEM_STATUS = 'acpd.system.show',
    GET_INTERFACES = 'acpd.system.interfaces',

    UNKNOWN_DIAGNOSTIC_MODE = 'wifi.diagnostic.mode',
    UNKNOWN_DIAGNOSTIC_CALDATA = 'wifi.diagnostic.caldata',

    UNKNOWN_UPDATE_PHYS = 'acpd.update.phys',
    VALIDATE_CONFIGURATION = 'acpd.parseDirtyPlist',
    UPDATE_CONFIGURATION = 'acp.setDirtyPlist',

    CLEAR_LOG = 'acpd.clearLog',
    UNKNOWN_BUSY_LOOP_CONTROL = 'acpd.busyLoopControl',
    UNKNOWN_BTMM_RPC = 'btmm.rpc',
    UNKNOWN_ICLOUD_CACHED_LHBAG = 'icloud.cached.lhbag', // flags 0x00000002

    // For each Wi-Fi interface there are these functions:
    // WIFI_0_SET_CHANNEL = 'wifi.channel.set.wlan0', // flags 0x00000002
    // WIFI_0_GET_CHANNEL = 'wifi.channel.get.wlan0', // flags 0x00000002
    // WIFI_0_SET_MCS = 'wifi.mcs.set.wlan0', // flags 0x00000002
    // WIFI_0_GET_MCS = 'wifi.mcs.get.wlan0', // flags 0x00000002
    // WIFI_0_SET_TX_RATE = 'wifi.tx.rate.set.wlan0', // flags 0x00000002
    // WIFI_0_GET_TX_RATE = 'wifi.tx.rate.get.wlan0', // flags 0x00000002
    // WIFI_0_SET_MULTICAST_RATE = 'wifi.mcast.rate.set.wlan0', // flags 0x00000002
    // WIFI_0_GET_MULTICAST_RATE = 'wifi.mcast.rate.get.wlan0', // flags 0x00000002
    // WIFI_0_STAT = 'wifi.statistics.wlan0', // flags 0x00000002
    // WIFI_0_SCAN_RESULTS = 'wifi.scan.results.wlan0', // flags 0x00000002
    // WIFI_0_SCAN_REQUEST = 'wifi.scan.request.wlan0', // flags 0x00000002
    // WIFI_0_SET_DEBUG = 'wifi.debug.set.wlan0', // flags 0x00000002
    // WIFI_0_ROTATE_GTK = 'wifi.rotate.gtk.wlan0', // flags 0x00000002
    // WIFI_0_SET_AMPDU = 'wifi.ampdu.set.wlan0', // flags 0x00000002
    // WIFI_0_TAL_ADD_UPDATE = 'wifi.tal.add_update.wlan0', // flags 0x00000002
    // WIFI_0_TAL_REMOTE = 'wifi.tal.remove.wlan0', // flags 0x00000002
    // WIFI_0_SET_NEIGHBOR = 'wifi.neighbor.set.wlan0', // flags 0x00000002
}

export type RPCInputs = {
    [RPCFunction.GET_INTERFACES]: {};

    [RPCFunction.RENEW_DHCP_LEASE]: {
        action: 'renew';
    };

    [RPCFunction.START_WPS]: {
        flags: number;
        ttl: bigint;
        timeout: number;
        mode: number;
    };

    [RPCFunction.AUTHORISE_WPS]: {
        ttl: bigint;
        pin: string;
        mac: Buffer;
        name: string; // '(default)'
    };

    [RPCFunction.STOP_WPS]: {};

    [RPCFunction.VALIDATE_CONFIGURATION]: {
        drTY: {
            AUVs: '639.13-MacAU',
            ctim: number;
            lcVr: number;
            WiFi?: PropertyTypes.WiFi;
            auNP?: string;
            lcVs: '639.13-MacAU';
            Prof: Buffer;
            syIg: PropertyTypes.syIg;
            timz: PropertyTypes.timz;
        };
    };

    [RPCFunction.UPDATE_CONFIGURATION]: {
        allowMinimal: true;
        drTY: {
            AUVs: '639.13-MacAU',
            ctim: number;
            lcVr: number;
            WiFi?: PropertyTypes.WiFi;
            auNP?: string;
            lcVs: '639.13-MacAU';
            Prof: Buffer;
            syIg: PropertyTypes.syIg;
            timz: PropertyTypes.timz;
        };
    };

    [RPCFunction.GET_RPC_FUNCTIONS]: {
        cmd: 'show';
    };
    [RPCFunction.GET_MONITOR_STATUS]: {
        cmd: 'show';
    };
};

export type RPCOutputs = {
    [RPCFunction.GET_INTERFACES]: {};

    [RPCFunction.GET_RPC_FUNCTIONS]: {
        output: string;
    };
    [RPCFunction.GET_MONITOR_STATUS]: {
        output: string;
    };

    [RPCFunction.GET_STATIC_CONFIG]: {
        // apple-minvar, apple-sku, apple-sn, ethaddr, radio-cal-ath0, radio-cal-ath1
        variables: Record<string, string>;
    };
};
