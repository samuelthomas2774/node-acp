declare module 'bplist-creator' {
    class Real {
        value: number;
        constructor(value: number);
    }

    const create: {
        (data: any): Buffer;
        Real: typeof Real;
    };

    export = create;
}
