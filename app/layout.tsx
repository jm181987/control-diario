import type { ReactNode } from 'react';
export const metadata = { title: 'Control Diario', description: 'Registro y análisis comercial multiempresa' };
export default function RootLayout({children}:{children:ReactNode}) { return <html lang="es"><body style={{margin:0,fontFamily:'system-ui, sans-serif',background:'#0b1220',color:'#eef2ff'}}>{children}</body></html> }
