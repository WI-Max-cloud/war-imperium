import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultContent,updateContent,validateImage} from './content-store.mjs';
test('Ziele und News validieren Revisionen und bewahren Klartext',()=>{
 const initial=defaultContent();const {next}=updateContent(initial,{action:'news-add',revision:0,title:'<script>Test</script>',text:'Nachricht\nZeile 2'});
 assert.equal(next.news[0].title,'<script>Test</script>');assert.equal(initial.news.length,0);assert.equal(next.revision,1);
 assert.throws(()=>updateContent(next,{action:'news-add',revision:0,title:'a',text:'b'}),{status:409});
 assert.throws(()=>updateContent(next,{action:'goals',revision:1,goals:[]}),{status:400});
 const changed=updateContent(next,{action:'goals',revision:1,goals:[{title:'Neues Ziel',text:'Beschreibung'}]}).next;assert.equal(changed.goals[0].title,'Neues Ziel');
 const deleted=updateContent(changed,{action:'news-delete',revision:2,id:next.news[0].id}).next;assert.equal(deleted.news.length,0);
});
test('Galerie lehnt aktive Inhalte und übergroße Bilder ab',()=>{
 assert.throws(()=>validateImage('data:image/svg+xml;base64,PHN2Zz4='),{status:400});
 assert.throws(()=>validateImage('data:image/jpeg;base64,AAAA'),{status:400});
 assert.throws(()=>validateImage('data:image/jpeg;base64,'+'A'.repeat(1400000)),{status:400});
 const image='data:image/jpeg;base64,'+Buffer.from([255,216,255,0,255,217]).toString('base64');
 const result=updateContent(defaultContent(),{action:'image-add',revision:0,title:'Turnierfoto',image});assert.equal(result.next.gallery.length,1);assert.ok(result.image);assert.equal(result.next.gallery[0].image,undefined);
 assert.equal(updateContent(result.next,{action:'image-delete',revision:1,id:result.next.gallery[0].id}).next.gallery.length,0);
});
