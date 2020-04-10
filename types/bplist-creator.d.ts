declare module 'bplist-creator' {
    class Real {
        value: number;
        constructor(value: number);
    }

    function create(data: any): Buffer;

    namespace create {
        export {Real};
    }

    export = create;
}
