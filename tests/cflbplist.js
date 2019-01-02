
const {default: CFLBinaryPList} = require('../dist/cflbinary');

const plist = Buffer.from('43464230d07070726f626c656d7300a00000454e4421', 'hex');

const object = CFLBinaryPList.parse(plist.toString('binary'));

// Should log {problems: []}
console.log(object);

const object2 = {something: {lol: ['i', 'd', 'k']},
    brillant: [1, 2, 3, 4, 5, 0x10000000]};
const plist2 = CFLBinaryPList.compose(object2);

console.log(object2, plist2);

const object2_2 = CFLBinaryPList.parse(plist2);

// Should log object2
console.log(object2_2);

const object3 = [1, 2, 3, 4, 65535, 65536, 65537];
const plist3 = CFLBinaryPList.compose(object3);

console.log(object3, plist3);

const object3_2 = CFLBinaryPList.parse(plist3);

// Should log object3
console.log(object3_2);

const object4 = [1.1, 65534.1, 65534.1];
const plist4 = CFLBinaryPList.compose(object4);

console.log(object4, plist4);

const object4_2 = CFLBinaryPList.parse(plist4);

// Should log object4
console.log(object4_2);
