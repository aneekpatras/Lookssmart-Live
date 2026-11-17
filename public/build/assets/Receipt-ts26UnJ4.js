import{r as e,j as t}from"./vendor-react-DDzxHNG9.js";import{a as m}from"./index-DRvw75o-.js";import{B as o}from"./app-Dv4Wg2I1.js";import{D as l,b as c,c as d,d as u,f as x}from"./dialog-CMm1_QNS.js";import{R as f,T as h}from"./ThermalReceipt-CZHpjdqC.js";import{P as g}from"./printer-CYbRMzHk.js";import"./vendor-inertia-D1WI-VC0.js";/* empty css            */import"./index-C6h8TOex.js";import"./index-Ck0OwNVH.js";import"./x-CAAQCABW.js";import"./createLucideIcon-CH7-WAoM.js";import"./currency-CP2gLfL6.js";const j=`
  @media print {
    body * { visibility: hidden !important; }
    [role="dialog"] > *:not(#thermal-receipt-print) { display: none !important; }
    #thermal-receipt-print, #thermal-receipt-print * { visibility: visible !important; }
    #thermal-receipt-print {
      display: block !important;
      position: absolute; left: 0; top: 0;
      width: 80mm !important;
      max-width: 80mm !important;
      font-family: 'Courier New', Courier, monospace !important;
      font-size: 11px !important;
      color: #000 !important;
      background: #fff !important;
      padding: 0; margin: 0;
    }
    @page { size: 80mm auto; margin: 0; }
  }
`;function z({saleId:a,onClose:n}){const[i,p]=e.useState(null),s=e.useRef(!1);return e.useEffect(()=>{m.get(`/admin/pos/sales/${a}/receipt`).then(r=>p(r.data.sale))},[a]),e.useEffect(()=>{i&&!s.current&&(s.current=!0,window.print())},[i]),t.jsxs(l,{open:!0,onOpenChange:r=>!r&&n(),children:[t.jsx("style",{children:j}),t.jsxs(c,{className:"max-w-lg",children:[t.jsx(d,{children:t.jsx(u,{children:"Receipt"})}),i?t.jsxs(t.Fragment,{children:[t.jsx(f,{sale:i}),t.jsx(h,{sale:i}),t.jsxs(x,{children:[t.jsx(o,{type:"button",variant:"outline",asChild:!0,children:t.jsx("a",{href:`/admin/pos/sales/${i.id}`,children:"View invoice"})}),t.jsxs(o,{type:"button",variant:"outline",onClick:()=>window.print(),children:[t.jsx(g,{className:"size-4"}),"Print"]}),t.jsx(o,{type:"button",onClick:n,children:"New sale"})]})]}):t.jsx("p",{className:"text-ink-muted text-sm",children:"Loading receipt…"})]})]})}export{z as ReceiptDialog};
