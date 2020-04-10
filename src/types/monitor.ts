
export type MonitorProp = 'logm' | 'ACPRemoteBonjour' | 'MaSt' | 'waCD' | 'waC1' | 'waRA' | 'daSt' | 'tACL' | 'dmSt' |
    'waIP' | 'wsci' | 'sySt' | 'stat' | 'raCh' | 'waC2' | 'DynS' | 'prnR' | 'waSM' | 'iCld' | 'deSt' |
    'raSL';

export interface MonitorRequestData {
    filters?: {
        [K in MonitorProp]?: {};
    };
}

export type MonitorData = {
    [K in MonitorProp]?: any;
};
