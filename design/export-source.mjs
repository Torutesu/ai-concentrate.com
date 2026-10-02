import fs from 'node:fs';
import ts from 'typescript';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {FlaskConical,LayoutGrid,Layers3,BookOpen,Plus,ChevronRight,Download,Upload,Copy,Search,Video,FileText,Sparkles,ArrowUpRight} from 'lucide-react';
const js=ts.transpileModule(fs.readFileSync('lib/content.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022}}).outputText;
const content=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const icons=Object.fromEntries(Object.entries({FlaskConical,LayoutGrid,Layers3,BookOpen,Plus,ChevronRight,Download,Upload,Copy,Search,Video,FileText,Sparkles,ArrowUpRight}).map(([name,icon])=>[name,renderToStaticMarkup(React.createElement(icon,{size:24}))]));
fs.writeFileSync('design/source.json',JSON.stringify({seeds:content.seeds,axes:content.axes,channels:content.channels,icons},null,2));
