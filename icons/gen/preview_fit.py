import json, os, sys
from PIL import Image
R='assets/'; P=json.load(open('gen/placement.json'))
out=sys.argv[1]
tiles=[]
for name,layers in P.items():
  ref=Image.open(R+'Original_References/'+name+'.png').convert('RGBA')
  can=Image.new('RGBA',(600,600),(0,0,0,0))
  for L in layers[::-1]:
    im=Image.open(R+L['file']).convert('RGBA'); s=L['s']
    im=im.resize((round(im.width*s),round(im.height*s)),Image.LANCZOS)
    tmp=Image.new('RGBA',(600,600),(0,0,0,0)); tmp.paste(im,(round(L['x']),round(L['y'])),im); can=Image.alpha_composite(can,tmp)
  t=Image.new('RGB',(400,200),(255,255,255))
  for i,im in enumerate((ref,can)):
    bg=Image.new('RGBA',(600,600),(255,255,255,255)); bg.alpha_composite(im); t.paste(bg.convert('RGB').resize((200,200)),(i*200,0))
  tiles.append(t)
S=Image.new('RGB',(800,600))
for i,t in enumerate(tiles): S.paste(t,((i%2)*400,(i//2)*200))
S.save(out,quality=40)
