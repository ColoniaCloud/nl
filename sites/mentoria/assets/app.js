function siteUi(){return {open:false}};
document.getElementById('year')&&(document.getElementById('year').textContent=''+new Date().getFullYear());
(function(){
  var holder=document.getElementById('socialLinks');
  if(!holder)return;
  fetch('/assets/social-links.json',{cache:'no-store'}).then(function(r){return r.ok?r.json():[]}).then(function(items){
    if(!Array.isArray(items)||items.length===0){holder.innerHTML='<p class="lead">Todavia no hay redes configuradas.</p>';return;}
    holder.innerHTML=items.map(function(item){
      var name=String(item.name||item.platform||'Red');
      var url=String(item.url||'#');
      return '<a class="social-chip" href="'+url+'" target="_blank" rel="noreferrer noopener">'+name+'</a>';
    }).join('');
  }).catch(function(){holder.innerHTML='<p class="lead">No se pudieron cargar las redes.</p>';});
})();