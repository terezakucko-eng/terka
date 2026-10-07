"""Džin s pusinkou: místo „S“ vepíše „−25 %“ písmem Inter Tight ExtraBold (výstup 2000 px)."""
import os
import numpy as np, cv2
from PIL import Image, ImageDraw, ImageFont
HERE=os.path.dirname(os.path.abspath(__file__))
src=Image.open(os.path.join(HERE,'assets','dzin-pusinka-original.webp')).convert('RGBA')
a=np.array(src).astype(int)
r,g,b,al=a[...,0],a[...,1],a[...,2],a[...,3]
pink=(abs(r-214)<30)&(g<70)&(abs(b-83)<40)&(al>200)
m=pink.astype(np.uint8)*255
cnts,_=cv2.findContours(m,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_NONE)
c=max(cnts,key=cv2.contourArea)
x,y,w,h=cv2.boundingRect(c); print('pusinka bbox',x,y,w,h)
fill=np.zeros_like(m); cv2.drawContours(fill,[c],-1,255,-1)
# jen „S“: nerůžové plochy celé uvnitř střední části pusinky
holes=((fill>0)&(~pink)).astype(np.uint8)
n,lab,st,_=cv2.connectedComponentsWithStats(holes)
S_mask=np.zeros_like(m)
for i in range(1,n):
    hx,hy,hw,hh,ar=st[i]
    if hx>x+0.2*w and hx+hw<x+0.8*w and hy>y+0.15*h and hy+hh<y+0.85*h and ar>50:
        S_mask[lab==i]=255; print('S comp',hx,hy,hw,hh,ar)
fill=cv2.dilate(S_mask,np.ones((5,5),np.uint8))
med=np.median(a[pink][:,:3],axis=0).astype(int); print('pink median',med)
out=np.array(src)
out[fill>0,:3]=med
base=Image.fromarray(out)
S=2  # zvětšení na 2000 px (Džin má v tisku ~96 mm, tj. ~530 dpi)
big=base.resize((base.width*S,base.height*S),Image.LANCZOS)
d=ImageDraw.Draw(big)
font=ImageFont.truetype(os.path.join(HERE,'fonts','intertight-extrabold.ttf'),int(56*S))
txt='−25 %'
# prostrkání −2 % (jako nadpisy v brand booku), kreslí se po znacích
size=font.size; track=-0.02*size
glyphs=[(ch,font.getlength(ch)) for ch in txt]
tw=sum(l for _,l in glyphs)+track*(len(glyphs)-1)
asc,desc=font.getmetrics()
bb=font.getbbox('25%'); th=bb[3]-bb[1]
cx=(x+w/2)*S; cy=(y+h/2)*S
px=cx-tw/2; py=cy-th/2-bb[1]
for ch,l in glyphs:
    d.text((px,py),ch,font=font,fill=(255,255,255,255)); px+=l+track
big.save(os.path.join(HERE,'assets','dzin-pusinka-25.png'))
print('text width',tw/S,'pusinka w',w)
