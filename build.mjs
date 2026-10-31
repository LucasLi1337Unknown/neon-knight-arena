import {build} from 'esbuild';
import {mkdir,copyFile} from 'node:fs/promises';
await mkdir('dist',{recursive:true});
await build({entryPoints:['app.js'],bundle:true,minify:true,format:'esm',outfile:'dist/app.js',target:'es2022',legalComments:'eof'});
await build({entryPoints:['engine.js'],bundle:true,minify:true,format:'esm',outfile:'dist/engine.js',target:'es2022',legalComments:'eof'});
for(const name of ['index.html','style.css','config.js','THIRD_PARTY_LICENSES.txt'])await copyFile(name,'dist/'+name);
console.log('Built Neon Knight Arena');
