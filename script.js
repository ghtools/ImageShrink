// ImageShrink - main application logic
const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const workspace = document.getElementById('workspace');
  const beforeImg = document.getElementById('beforeImg');
  const afterImg = document.getElementById('afterImg');
  const beforeSize = document.getElementById('beforeSize');
  const afterSize = document.getElementById('afterSize');
  const pctReduced = document.getElementById('pctReduced');
  const trackFill = document.getElementById('trackFill');
  const qualitySlider = document.getElementById('qualitySlider');
  const qualityVal = document.getElementById('qualityVal');
  const widthInput = document.getElementById('widthInput');
  const heightInput = document.getElementById('heightInput');
  const lockRatio = document.getElementById('lockRatio');
  const downloadBtn = document.getElementById('downloadBtn');
  const resetBtn = document.getElementById('resetBtn');
  const installBtn = document.getElementById('installBtn');
  const formatBtns = document.querySelectorAll('.format-btn');
  const qualityNote = document.getElementById('qualityNote');
  const pdfBtn = document.getElementById('pdfBtn');

  let selectedFormat = 'jpeg', selectedExt = 'jpg';
  let rotation = 0, flipH = false, flipV = false;

  let originalImage = null, originalFile = null, originalW = 0, originalH = 0;
  let aspectLocked = true, compressedBlob = null;

  function fmtSize(bytes){
    if(bytes < 1024) return bytes + ' B';
    if(bytes < 1024*1024) return (bytes/1024).toFixed(1) + ' KB';
    return (bytes/1024/1024).toFixed(2) + ' MB';
  }

  function handleFile(file){
    if(!file || !file.type.startsWith('image/')) return;
    originalFile = file;
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        originalImage = img; originalW = img.width; originalH = img.height;
        beforeImg.src = e.target.result;
        widthInput.value = originalW; heightInput.value = originalH;
        beforeSize.textContent = fmtSize(file.size);
        workspace.style.display = 'block';
        dropzone.style.display = 'none';
        compress();
        workspace.scrollIntoView({behavior:'smooth', block:'start'});
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  function compress(){
    if(!originalImage) return;
    const w = parseInt(widthInput.value) || originalW;
    const h = parseInt(heightInput.value) || originalH;
    const rotated90 = rotation === 90 || rotation === 270;
    const canvasW = rotated90 ? h : w;
    const canvasH = rotated90 ? w : h;
    const canvas = document.createElement('canvas');
    canvas.width = canvasW; canvas.height = canvasH;
    const ctx = canvas.getContext('2d');
    // JPG has no alpha channel, so transparent areas would otherwise render black
    if(selectedFormat === 'jpeg'){
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvasW, canvasH);
    }
    ctx.save();
    ctx.translate(canvasW / 2, canvasH / 2);
    ctx.rotate(rotation * Math.PI / 180);
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
    ctx.drawImage(originalImage, -w / 2, -h / 2, w, h);
    ctx.restore();
    const quality = parseInt(qualitySlider.value) / 100;
    const mime = 'image/' + selectedFormat;

    if(selectedFormat === 'png'){
      qualitySlider.disabled = true;
      qualityNote.textContent = 'PNG is lossless — quality slider has no effect here.';
    } else {
      qualitySlider.disabled = false;
      qualityNote.textContent = '';
    }

    canvas.toBlob(blob => {
      compressedBlob = blob;
      afterImg.src = URL.createObjectURL(blob);
      afterSize.textContent = fmtSize(blob.size);
      const reduction = Math.max(0, Math.round((1 - blob.size / originalFile.size) * 100));
      pctReduced.textContent = reduction + '%';
      trackFill.style.width = reduction + '%';
    }, mime, quality);
  }

  formatBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      formatBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedFormat = btn.dataset.format;
      selectedExt = btn.dataset.ext;
      compress();
    });
  });

  dropzone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', e => handleFile(e.target.files[0]));
  ['dragover','dragenter'].forEach(evt => dropzone.addEventListener(evt, e => { e.preventDefault(); dropzone.classList.add('drag'); }));
  ['dragleave','drop'].forEach(evt => dropzone.addEventListener(evt, e => { e.preventDefault(); dropzone.classList.remove('drag'); }));
  dropzone.addEventListener('drop', e => handleFile(e.dataTransfer.files[0]));

  qualitySlider.addEventListener('input', () => { qualityVal.textContent = qualitySlider.value + '%'; compress(); });
  widthInput.addEventListener('input', () => {
    if(aspectLocked && originalW) heightInput.value = Math.round(parseInt(widthInput.value || originalW) * originalH / originalW);
    compress();
  });
  heightInput.addEventListener('input', () => {
    if(aspectLocked && originalH) widthInput.value = Math.round(parseInt(heightInput.value || originalH) * originalW / originalH);
    compress();
  });
  lockRatio.addEventListener('click', () => { aspectLocked = !aspectLocked; lockRatio.classList.toggle('active', aspectLocked); });

  document.getElementById('rotateLeftBtn').addEventListener('click', () => { rotation = (rotation + 270) % 360; compress(); });
  document.getElementById('rotateRightBtn').addEventListener('click', () => { rotation = (rotation + 90) % 360; compress(); });
  document.getElementById('flipHBtn').addEventListener('click', (e) => { flipH = !flipH; e.currentTarget.classList.toggle('active', flipH); compress(); });
  document.getElementById('flipVBtn').addEventListener('click', (e) => { flipV = !flipV; e.currentTarget.classList.toggle('active', flipV); compress(); });

  downloadBtn.addEventListener('click', () => {
    if(!compressedBlob) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(compressedBlob);
    a.download = originalFile.name.replace(/\.[^/.]+$/, '') + '-compressed.' + selectedExt;
    a.click();
  });

  pdfBtn.addEventListener('click', () => {
    if(!compressedBlob) return;
    pdfBtn.textContent = 'Preparing PDF...';
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const { jsPDF } = window.jspdf;
        const orientation = img.width > img.height ? 'l' : 'p';
        const pdf = new jsPDF({ orientation, unit: 'px', format: [img.width, img.height] });
        pdf.addImage(reader.result, selectedFormat === 'png' ? 'PNG' : 'JPEG', 0, 0, img.width, img.height);
        pdf.save(originalFile.name.replace(/\.[^/.]+$/, '') + '.pdf');
        pdfBtn.textContent = 'Convert to PDF';
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(compressedBlob);
  });

  resetBtn.addEventListener('click', () => {
    workspace.style.display = 'none'; dropzone.style.display = 'block';
    fileInput.value = ''; originalImage = null; compressedBlob = null;
    selectedFormat = 'jpeg'; selectedExt = 'jpg'; qualitySlider.disabled = false; qualityNote.textContent = '';
    formatBtns.forEach(b => b.classList.toggle('active', b.dataset.format === 'jpeg'));
    rotation = 0; flipH = false; flipV = false;
    document.getElementById('flipHBtn').classList.remove('active');
    document.getElementById('flipVBtn').classList.remove('active');
  });

  // PWA: service worker + install prompt
  if('serviceWorker' in navigator){
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(()=>{}));
  }
  let deferredPrompt;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); deferredPrompt = e;
    installBtn.style.display = 'inline-block';
  });
  installBtn.addEventListener('click', async () => {
    if(!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    installBtn.style.display = 'none';
  });

  const moreToolsBtn = document.getElementById('moreToolsBtn');
  const toolsDropdown = document.getElementById('toolsDropdown');
  moreToolsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = toolsDropdown.classList.toggle('open');
    moreToolsBtn.setAttribute('aria-expanded', isOpen);
  });
  document.addEventListener('click', () => toolsDropdown.classList.remove('open'));

  // iOS Safari doesn't fire beforeinstallprompt, so show manual instructions instead
  const isIOS = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  if(isIOS && !isStandalone){
    document.getElementById('iosInstallBanner').style.display = 'block';
                                         }
