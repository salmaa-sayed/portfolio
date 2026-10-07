const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const context = {window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root, 'content/content.js'),'utf8'), context);
const content = context.window.SITE_CONTENT;
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'media/manifest.json'),'utf8'));
const expected = ['isDsxGrKy_M','2_83tmPxycc','lex8r6LOHu8','XN4P5rIAQjU','huGofbtz-b4','eRFnpAxorso','WHof-wzP970','dBLbzSQgc6I','KIV_ARPy8aA','xY_oTtFAGRo','z68RErUQRPE','USarlIfU78k','zvoBdHHm600','ODt0ao291vc','RtL4B8awR8s','VVMzcErR5yo','ttAh6XKlP6E','c5hBQKr6CWo','_WOKJZZFybs'];
test('all 19 supplied videos are local, mapped once, and have matching posters', () => {
  const items = content.sections.flatMap(section => section.items);
  assert.deepEqual(Array.from(items, item=>item.id).sort(), expected.slice().sort());
  assert.deepEqual(Array.from(content.sections, section => section.items.length), [4,4,11]);
  for (const item of items) {
    assert.ok(!item.embed && !item.external);
    assert.match(item.src, /^media\/(motion|teasers|reels)\/[\w-]+\.mp4$/);
    assert.ok(fs.statSync(path.join(root,item.src)).size > 10000);
    assert.ok(fs.statSync(path.join(root,item.poster)).size > 1000);
    assert.equal(manifest.find(entry=>entry.id===item.id).path,item.src);
  }
});
test('MP4s are fast-start, H.264/AAC, and retain meaningful durations', () => {
  for (const item of manifest) {
    assert.equal(item.videoCodec,'h264'); assert.equal(item.audioCodec,'aac'); assert.equal(item.pixelFormat,'yuv420p');
    assert.ok(item.duration > 5); assert.ok(item.width <= 1280 && item.height <= 720);
    const bytes = fs.readFileSync(path.join(root,item.path));
    let offset = 0; const atoms = [];
    while (offset+8 <= bytes.length) {
      const size = bytes.readUInt32BE(offset); const type = bytes.toString('ascii',offset+4,offset+8);
      assert.ok(size >= 8, `invalid atom in ${item.path}`); atoms.push(type); offset += size;
    }
    assert.ok(atoms.indexOf('moov') >= 0 && atoms.indexOf('moov') < atoms.indexOf('mdat'), `${item.path} must start playing before the whole file downloads`);
    assert.equal(bytes.length,item.bytes);
  }
  assert.ok(manifest.reduce((sum,item)=>sum+item.bytes,0) < 30*1024*1024);
});
