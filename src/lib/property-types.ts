type types = {
    DynS: DynS;
    cloD: cloD;
    fire: fire;
    syLR: syLR;
    syAR: syAR;
    sySI: sySI;
    CLTM: CLTM;
    sySt: sySt;
    syIg: syIg;
    timz: timz;
    usrd: usrd;
    stat: stat;
    dSpn: dSpn;
    raSL: raSL;
    raSR: raSR;
    WiFi: WiFi;
    rCAL: rCAL;
    waDI: waDI;
    DRes: DRes;
    dhSL: dhSL;
    tACL: tACL;
    USBi: USBi;
    prni: prni;
    MaSt: MaSt;
    Prof: Prof;
    wsci: wsci;
    auHK: auHK;
    pECC: pECC;
    rteI: rteI;
    iCld: iCld;
    iCLH: iCLH;
};

export default types;

/** An IPv4 address (0.0.0.0) */
type IPv4Address = string;
/** An IPv6 address */
type IPv6Address = string;
/** A UUID (00000000-0000-0000-0000-000000abcdef) */
type UUID = string;
/** A MAC address (00:00:00:AB:CD:EF) */
type MACAddress = string;

/** Back To My Mac domain (x.members.btmm.icloud.com.) */
type BackToMyMacDomain = string;

export interface _6fwl {
    entries: IPv6FirewallEntry[];
}

export interface IPv6FirewallEntry {
    allowAll: boolean;
    description: string;
    host: IPv6Address;
    /** Comma-separated numbers (e.g. 80, 443) */
    tcpPorts: string;
    /** Comma-separated numbers (e.g. 53) */
    udpPorts: string;
}

export interface DynS {
  'State:/Network/PrivateDNS': never[];
  /** Domains to use Multicast DNS for (local, 254.169.in-addr.arpa, 8.e.f.ip6.arpa, 9.e.f.ip6.arpa, a.e.f.ip6.arpa, b.e.f.ip6.arpa) */
  'State:/Network/MulticastDNS': string[];
  'State:/Network/BackToMyMac': Record<BackToMyMacDomain, BackToMyMacAccount>;
}

export interface BackToMyMacAccount {
    AutoTunnelExternalPort: number;
    StatusMessage: 'Success';
    RouterAddress: IPv4Address;
    StatusCode: number;
    ExternalAddress: IPv4Address;
    LastNATMapResultCode: number;
}

export interface cloD {
    clouds: Record<UUID, ACPSyncGroup>;
}

export interface ACPSyncGroup {
    [key: string /** Record ID (e.g. timedAccess/00:00:00:AB:CD:EF) */]: ACPSyncRecord;
}

export interface ACPSyncRecord {
    authorUUID: string;
    // content?: ACPSyncRecordContent;
    content?: AccessControlEntry;
    nanoUTC: bigint;
    type: 'set' | 'remove';
}

// export interface ACPSyncRecordContent {
//     description: string;
//     expiryTime?: bigint;
//     macAddress: MACAddress;
//     wirelessAccessTimes: string[];
// }

export interface fire {
    firewallEnabled: boolean;
    entries: FirewallEntry[];
}

export interface FirewallEntry {
    entryEnabled: boolean;
    /** Comma-separated numbers (e.g. 80, 443) */
    tcpPublicPorts: string;
    description: string;
    serviceType: string;
    /** Comma-separated numbers (e.g. 53) */
    udpPrivatePorts: string;
    advertiseService: boolean;
    serviceName: string;
    /** Comma-separated numbers (e.g. 80, 443) */
    tcpPrivatePorts: string;
    /** Comma-separated numbers (e.g. 53) */
    udpPublicPorts: string;
    hosts: IPv4Address[];
}

export interface syLR {
    regions: Region[];
}

export interface syAR {
    regions: Region[];
}

export interface Region {
    ht40_5GHz: boolean;
    '80211n_2_4GHz': boolean;
    '80211n_5GHz': boolean;
    '5GHz_n_only_channels': never[];
    a_only_channels: number[];
    ht40_2_4GHz: boolean;
    bgn_channels: never[];
    '2_4GHz_channels': number[];
    '5GHz_DFS_channels': number[];
    g_only_channels: never[];
    region: number;
    '5GHz_channels': number[];
    '5GHz_wide_channels': number[];
    '2_4GHz_n_only_channels': never[];
    bg_channels: never[];
    an_channels: never[];
    b_only_channels: never[];
}

export type sySI = Temperature[];

export interface Temperature {
    name: string;
    value: number | bigint;
    thousandths: number;
}

export interface CLTM {
    verbose: number;
    EstECapTemp: number;
    Imax: number;
    CLTMAsleep: number;
    Last_w: number;
    TargetTemp: number;
    Imin: number;
    override5: bigint;
    override24: bigint;
    Kp: number;
    disabled: number;
    Ki: number;
    BadSensors: 0;
    Ts: number;
    Last_uVal: number;
}

export interface sySt {
    problems: ProblemCode[];
}

export interface syIg {
    problems: ProblemCode[];
}

export interface ProblemCode {
    code: StatusCodes;
}

export enum StatusCode {
    SETUP_OVER_WAN = 'waCF',
    USB_POWER_INSUFFICIENT = 'usbf',
    ETHERNET_UNPLUGGED = 'waNL',
    UPDATE_AVAILABLE = 'upAv',
    UNRECOGNIZED_APPLE_ID_PASSWORD = 'iCPW',
    UNKNOWN_DUBN = 'DubN',
    UNKNOWN_6RDN = '6rdn',
    UNKNOWN_OPNW = 'opNW',
    UNKNOWN_PPNS = 'ppNS',
}

type StatusCodes = 'waCF' | 'usbf' | 'waNL' | 'upAv' | 'iCPW' | 'DubN' | '6rdn' | 'opNW' | 'ppNS';

export interface timz {
    zoneVersion: string; // '2018g'
    zoneName: string;
    zoneFile: Buffer;
}

export interface usrd {
    users: FileSharingUser[];
}

export interface FileSharingUser {
    password: string;
    fileSharingAccess: number;
    name: string;
}

export enum FileSharingAccess {
    READ_WRITE = 0,
    READ_ONLY = 1,
    NOT_ALLOWED = 2,
}

export interface stat {
    anonUUID: string;
    entries: DebugDataEntry[];
    version: number;
}

export interface DebugDataEntry {
    data: Buffer;
    title: string;
    dictID: number;
}

export interface dSpn {
    DiskHasSpunDown: number;
}

export interface raSL {
    [ifname: string]: WiFiClient[];
}

export interface WiFiClient {
    txrate_local: number;
    nf_chain: bigint[];
    txrate: number;
    rssi_local: bigint;
    rates: string;
    rxPkt: number;
    phy_mode: string; // '802.11a/n'
    ampdu: string; // 'on'
    rxBytes: number;
    rssi_chain: bigint[];
    inact: number;
    rssi: bigint;
    noise: bigint;
    txPkt: number;
    timeAssoc: number;
    opmode: string; // 'sta'
    txpower: number;
    mcsindex_local: number;
    macAddress: MACAddress;
    '11n_mode': string;
    htcaps: number;
    txBytes: bigint;
}

export interface raSR {
    scan_results: ScanResults[];
}

export interface ScanResults {
    [ifname: string]: ScanResultsData[];
}

export interface ScanResultsData {
    IE: Buffer;
    BEACON_INT: number;
    HT_INFO_IE?: {
        IE_KEY_HT_INFO_EXT_CHANNEL: number | bigint;
    };
    HT_CAPS_IE?: {
        IE_KEY_HT_CAPS_HT40: boolean;
    };
    RSN_IE?: {
        IE_KEY_RSN_UCIPHERS: number[];
        IE_KEY_RSN_MCIPHER: number;
        IE_KEY_RSN_AUTHSELS: number[];
        IE_KEY_RSN_VERSION: number;
    };
    RATES: number[];
    SSID_STR: string;
    CAPABILITIES: number;
    RSSI: bigint;
    BSSID: string;
    SSID: Buffer;
    DWDS_IE?: {
        IE_KEY_DWDS_ROLE: number;
        IE_KEY_DWDS_VERSION: number;
    };
    WPA_IE?: {
        IE_KEY_WPA_AUTHSELS: number[];
        IE_KEY_WPA_UCIPHERS: number[];
        IE_KEY_WPA_VERSION: number; // 1
        IE_KEY_WPA_MCIPHER: number;
    };
    '80211D_IE'?: {
        IE_KEY_80211D_LOCATION: string;
        IE_KEY_80211D_CHAN_INFO_ARRAY: {
            IE_KEY_80211D_NUM_CHANNELS: number;
            IE_KEY_80211D_MAX_POWER: number;
            IE_KEY_80211D_FIRST_CHANNEL: number;
        }[];
        IE_KEY_80211D_COUNTRY_CODE: string;
    };
    APPLE_IE?: {
        APPLE_IE_VERSION: number; // 1
        APPLE_IE_WPS_CAP: boolean;
        APPLE_IE_PRODUCT_ID: number;
    };
    CHANNEL: number;
    NOISE: number;
}

export interface WiFi {
    radios: WiFiRadioConfiguration[];
    guestnet_intrabss?: boolean;
}

export interface WiFiRadioConfiguration {
    legacywds: never[];
    raSk: boolean;
    country: string;
    acEn: boolean;
    raWE: Buffer;
    /** Transmit Power (10 - 10%, 25 - 25%, 50 - 50%, 100 - 100%) */
    raPo: number;
    /** Use wide channels */
    raWC: boolean;
    iso_cc: string;
    raU2: number;
    /** Radio mode */
    raMd: RadioMode;
    /** Wireless network mode */
    raSt: WirelessNetworkMode;
    /** Wi-Fi Network Name (SSID) */
    raNm: string;
    /** RADIUS server #1 IPv4 address */
    raI1: IPv4Address;
    /** RADIUS server #2 IPv4 address */
    raI2: IPv4Address;
    raF2: number;
    raCA: boolean;
    phymodes: number;
    raT2: number;
    dwFl: number;
    raFl: number;
    /** Password */
    raCr: Buffer;
    /** WPA Enterprise ?? */
    raEA: boolean;
    rTSN: boolean;
    /** Allow this network to be extended */
    dWDS: boolean;
    raRe: number;
    vaps: AdditionalWiFiNetwork[];
    raEV: number;
    raCi: boolean;
    /** Channel ?? */
    raCh: number;
    raRo: boolean;
    /** Hidden/closed network */
    raCl: boolean;
    /** RADIUS server #2 secret */
    raS2: string;
    sku: string;
    raDt: number;
    raR2: number;
    /** WPA Group Key Timeout */
    raKT: number;
    ra1C: boolean;
    /** MAC address */
    raMA: Buffer;
    /** RADIUS server #1 port ?? */
    raAu: number;
    raTm: number;
    wdFl: number;
    raDe: number;
    raWM: number;
    /** Multicast rate (1 - 1 Mbps, 2 - 2 Mbps, 85 - 5.5 Mbps, 6 - 6 Mbps, 9 - 9 Mbps, 17 - 11 Mbps, 18 - 12 Mbps, 24 - 18 Mbps, 36 - 24 Mbps) */
    raMu: number;
    /** RADIUS server #1 secret */
    raSe: string;
}

export enum RadioMode {
    '802.11b only' = 1,
    '802.11b/g compatible' = 2,
    '802.11g only' = 3,
    '802.11a only' = 4,
    '802.11n (802.11a compatible)' = 5,
    '802.11n (802.11b/g compatible)' = 6,
    '802.11n only (2.4 GHz)' = 7,
    '802.11n only (5 GHz)' = 8,
}

export enum WirelessNetworkMode {
    CREATE_NETWORK = 0,
    JOIN_NETWORK = 1,
    DISABLED = 3,
}

export interface AdditionalWiFiNetwork {
    raSk: boolean;
    raWE: Buffer;
    raNm: string;
    Mode: number; // Was set to 6 - the same as raMu ??
    Enabled: boolean;
    /** Password */
    raCr: Buffer;
    /** WPA Enterprise */
    raEA: boolean;
    rTSN: boolean;
    /** Hidden/closed network */
    raCl: boolean;
    /** WPA Group Key Timeout */
    raKT: number;
    raWM: number;
}

export interface rCAL {
    // Nothing here?
}

export interface waDI {
    // TODO
}

export interface DRes {
    dhcpReservations: DHCPReservation[];
}

export interface DHCPReservation {
    description: string;
    clientID?: string;
    ipv4Address: IPv4Address;
    macAddress?: MACAddress;
    type: DHCPReservationType;
}

export enum DHCPReservationType {
    DHCP_CLIENT_ID = 1,
    MAC_ADDRESS = 2,
}

export interface dhSL {
    leases: DHCPLease[];
}

export interface DHCPLease {
    interface: string;
    ipAddress: IPv4Address;
    leaseEnds: string; // 'Sat Nov 23 01:14:34 2019'
    leaseEndsTime: number; // 1574471674
    pool: 'active' | 'fixed';
    macAddress: MACAddress;
    hostname?: string;
}

export interface tACL {
    entries: AccessControlEntry[];
}

export interface AccessControlEntry {
    ssids?: AccessControlDeviceSpecificPSK[];
    description: string;
    expiryTime?: bigint;
    macAddress: MACAddress;
    /** Access times ("t=0-0" means access always allowed, "days=-------;t=0-0" means access never allowed) */
    wirelessAccessTimes: string[];
}

export interface AccessControlDeviceSpecificPSK {
    ssid: string;
    psk: Buffer | {type: 'Buffer'; data: number[];};
}

export interface USBi {
    devices: USBDevice[];
}

export interface USBDevice {
    power: 'self powered' | '200 mA';
    product: string;
    vendorNumber: number;
    address: number;
    deviceNames: string[];
    vendor: string;
    serial: string;
    revisionNumber: number;
    speed: 'full' | 'high';
    bus: 0 | 1;
    config: 1;
    productNumber: number;
    protocol: 0 | 1;
    ports?: (USBPort | USBDevice)[];
    subClass: 0;
    revision: '1.00';
    class: number;
}

export interface USBPort {
    state: 'powered';
}

export interface prni {
    printers: Printer[];
}

export interface Printer {
    pluggedIn: boolean;
    productID: number;
    model: string;
    make: string;
    name: string;
    generatedNumber: number;
    vendorID: number;
    appSocketPort: number;
    serialNumber: string;
}

export type MaSt = USBMassStorage[];

export interface USBMassStorage {
    product: string;
    blockSize: number;
    deviceName: string;
    size: number;
    vendor: string;
    partitions: Partition[];
    uuid: Buffer;
    info: string;
    revision: string;
    softDisconnected: boolean;
}

export interface Partition {
    format: 'msdos';
    sizeUsed: number;
    deviceName: string;
    size: number;
    users: number;
    name: string;
    sizeFree: number;
    uuid: Buffer;
}

export interface Prof {
    profiles: Profile[];
    restoreProfile: Profile;
    currentProfile: number;
}

export interface Profile {
    dhSN: IPv4Address;
    '6Wte': IPv4Address;
    peAO: boolean;
    /** PPPoE Disconnect if Idle (30 - 30 seconds, 60 - 1 minute, 120 - 2 minutes, 300 - 5 minutes, 600 - 10 minutes, 900 - 5 minutes, 1200 - 20 minutes, 1800 - 30 minutes, 0 - Never) */
    peID: number;
    dh95: string;
    pmPR: IPv4Address;
    fssp: string;
    IGMP: boolean;
    SUSv: string;
    /** Wide-area Bonjour TSIG Key */
    wbHU: string;
    /** Enable AOL Parental Controls */
    naAF: number;
    /** Configure IPv4 (768 - Using DHCP, 1024 - Manually) */
    waCV: number;
    /** Guest network DHCP lease time ?? */
    gnLe: number;
    syNm: string;
    pmPS: IPv4Address;
    SUEn: boolean;
    fire: fire;
    laSM: IPv4Address;
    /** Guest network DHCP message ?? */
    gnMg: string;
    '6sfw': boolean;
    syCt: string;
    naEn: IPv4Address;
    gnSN: IPv4Address;
    '6NS1': IPv6Address;
    /** Status light (1 - Always On (default), 2 - Flash On Activity) */
    leAc: number;
    usbF: number;
    raTr: number;
    gn95: string;
    syIg: syIg;
    slCl: IPv4Address;
    /** Guest network DHCP router address */
    gnRo: IPv4Address;
    '6Wgw': IPv6Address;
    pmPI: IPv4Address;
    '6NS2': IPv6Address;
    sttE: boolean;
    waDN: string;
    SUFq: number;
    snWW: string;
    waDC: string;
    snWL: string;
    '6aut': boolean;
    waSM: IPv4Address;
    SMBs: string;
    '6Wad': IPv6Address;
    name: string; // 'untitled' ??
    WiFi: WiFi;
    wbRD: string;
    /** IPv4 router address */
    waRA: IPv4Address;
    sttF: number;
    dhBg: IPv4Address;
    wbAC: boolean;
    wbRP: string;
    trCo: {};
    peUN: string;
    '6cfg': number;
    raDS: boolean;
    wbHN: string;
    '6Wfx': number;
    syPR: string;
    waIn: number;
    waSD: number;
    waCD: string;
    '6sec': boolean;
    snAF: number;
    naSN: IPv4Address;
    '6Lad': IPv6Address;
    gnBg: IPv4Address;
    raWB: boolean;
    syLo: string;
    naRo: IPv4Address;
    '6Lfw': boolean;
    raNA: boolean;
    dhEn: IPv4Address;
    syDN: string;
    tACL: tACL;
    snLW: Buffer;
    wbHP: string;
    peSN: string;
    SMBw: string;
    laIP: IPv4Address;
    ntSV: string;
    peSC: boolean;
    snLL: Buffer;
    waD1: IPv4Address;
    DRes: DRes;
    '6Lfx': number;
    waDS: boolean;
    '6trd': boolean;
    '6PDl': number;
    wbEn: boolean;
    timz: timz;
    '6PDa': IPv6Address;
    AUVs: string;
    waD2: IPv4Address;
    gnEn: IPv4Address;
    prnR: Buffer;
    waIP: IPv4Address;
    slvl: number;
    wbRU: string;
    pePW: string;
    naFl: number;
    nDMZ: IPv4Address;
    usrd: usrd;
    time: number;
    waD3: IPv4Address;
    /** IPv6 firewall entries ?? */
    '6fwl': {
        entries: never[];
    };
    naBg: IPv4Address;
    snRW: string;
    iCld: iCld;
    snRL: string;
    waNM: boolean;
    dhLe: number;
    syRe: number;
    syPW: string;
    peAC: boolean;
    dhMg: string;
}

export interface wsci {
    mode: number;
    joiners: never[];
}

export interface auHK {
    identifier: UUID;
    sk: Buffer;
    'AirPlay Accessories': never[];
    'HomeKit Accessories': HomeKitPairingData[];
    'HomeKit Enabled': boolean;
    'HomeKit Access Level': 0;
    pk: Buffer;
}

export interface HomeKitPairingData {
    identifier: UUID;
    /** HAP permissions (0 - normal user, 1 - admin) */
    permissions: HAPPermissions;
    pk: Buffer;
}

export enum HAPPermissions {
    USER = 0,
    ADMIN = 1,
}

export type pECC = {
    name: string;
    value: number;
}[];

export interface rteI {
    IPv4: IPv4Address;
}

export interface iCld {
    users: iCloudAccount[];
}

export interface iCloudAccount {
    ncBag: {
        url: string;
        mmeBTMMInfiniteToken: string;
        /** Number - the user's Apple ID identifier */
        dsPrsID: string;
    };
    /** The user's Apple ID email address */
    appleID: string;
    acctErrCode: bigint;
    accountStatus: number;
}

export interface iCLH {
    [appleid: string]: {
        acctErrCode: bigint;
        accountStatus: number;
    };
}
