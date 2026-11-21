const $ = id => document.getElementById(id);
let job = null, duration = 0, segments = [], selected = 0, zoom = 1, pxPerSecond = 2;
let language = "vi";
let statusTranslation = null, completedSegmentCount = null;
const video = $("preview");
const messages = {
  vi: {
    pageTitle: "Cắt audio từ video", pageSubtitle: "Chọn mốc thời gian và xuất âm thanh.", localLabel: "XỬ LÝ CỤC BỘ",
    sourceHeading: "Tệp video", dropPrompt: "Kéo video vào đây hoặc chọn từ thiết bị", fileTypes: "MP4, MOV, MKV, WebM · tối đa 1 GB",
    chooseVideo: "Chọn video", sourceNoteTitle: "Lưu ý:", sourceNote: "Tệp được tải lên từ thiết bị. Công cụ không tải video trực tiếp từ YouTube; chỉ sử dụng nội dung bạn có quyền xử lý.",
    selectionHeading: "Chọn đoạn cần cắt", previewPlaceholder: "Bản xem trước video sẽ hiển thị tại đây", durationLabel: "Thời lượng",
    currentTimeLabel: "Thời điểm hiện tại", timelineTitle: "Dòng thời gian", timelineHint: "Kéo hai tay nắm để chọn đoạn",
    zoomLabel: "Thu phóng", startLabel: "Bắt đầu", lengthLabel: "Độ dài", endLabel: "Kết thúc",
    startHandle: "Kéo mốc bắt đầu", endHandle: "Kéo mốc kết thúc", setStart: "Đặt mốc đầu tại thời điểm hiện tại",
    setEnd: "Đặt mốc cuối tại thời điểm hiện tại", segmentList: "Danh sách đoạn", addSegment: "＋ Thêm đoạn",
    uploadToStart: "Tải video lên để bắt đầu.", segmentHint: "Có thể nhập thời gian trực tiếp hoặc dùng các nút để lấy mốc từ vị trí phát hiện tại.",
    exportHeading: "Xuất âm thanh", formatLabel: "Định dạng", formatMp3: "MP3 — dung lượng nhỏ", formatWav: "WAV — không nén",
    formatM4a: "M4A — AAC", cutButton: "Cắt và xuất âm thanh", downloadResult: "↓ Tải kết quả", footer: "Cắt audio · Xử lý trên thiết bị · FFmpeg",
    segmentName: "Tên đoạn", startSeconds: "Bắt đầu (giây)", endSeconds: "Kết thúc (giây)", removeSegment: "Xóa đoạn",
    noSegments: "Chưa có đoạn nào. Nhấn “Thêm đoạn” để bắt đầu.", uploading: "Đang tải video lên thiết bị xử lý…",
    uploadFailure: "Không thể tải video lên.", videoReady: "Video đã sẵn sàng. Kéo tay nắm trên dòng thời gian để chọn đoạn.",
    addSegmentName: "Đoạn {number}", atLeastOne: "Hãy thêm ít nhất một đoạn.", invalidRange: "Đoạn {number}: mốc thời gian không hợp lệ.",
    cutting: "Đang xử lý âm thanh. Vui lòng đợi…", cutFailure: "Không thể xuất âm thanh.", downloadSingle: "↓ Tải audio",
    downloadMultiple: "↓ Tải ZIP ({count} đoạn)", cutComplete: "Đã xuất {count} đoạn. Tải kết quả bằng nút bên dưới.",
    fileReady: "✓ {name} · {duration} · {size} MB",
  },
  en: {
    pageTitle: "Audio cutter", pageSubtitle: "Choose a time range and export the audio.", localLabel: "LOCAL PROCESSING",
    sourceHeading: "Video file", dropPrompt: "Drop a video here or choose one from your device", fileTypes: "MP4, MOV, MKV, WebM · up to 1 GB",
    chooseVideo: "Choose video", sourceNoteTitle: "Note:", sourceNote: "Videos are uploaded from your device. This tool does not download videos directly from YouTube; only process content you have permission to use.",
    selectionHeading: "Choose segments", previewPlaceholder: "Video preview will appear here", durationLabel: "Duration",
    currentTimeLabel: "Current time", timelineTitle: "Timeline", timelineHint: "Drag the handles to select a segment",
    zoomLabel: "Zoom", startLabel: "Start", lengthLabel: "Length", endLabel: "End",
    startHandle: "Drag start point", endHandle: "Drag end point", setStart: "Set start to current time",
    setEnd: "Set end to current time", segmentList: "Segments", addSegment: "＋ Add segment",
    uploadToStart: "Upload a video to get started.", segmentHint: "Enter times directly or use the buttons to set a point at the current playback position.",
    exportHeading: "Export audio", formatLabel: "Format", formatMp3: "MP3 — smaller file", formatWav: "WAV — uncompressed",
    formatM4a: "M4A — AAC", cutButton: "Cut and export audio", downloadResult: "↓ Download result", footer: "Audio cutter · Processed on your device · FFmpeg",
    segmentName: "Segment name", startSeconds: "Start (seconds)", endSeconds: "End (seconds)", removeSegment: "Remove segment",
    noSegments: "No segments yet. Select “Add segment” to create one.", uploading: "Uploading video for local processing…",
    uploadFailure: "Could not upload the video.", videoReady: "Video is ready. Drag the timeline handles to select a segment.",
    addSegmentName: "Segment {number}", atLeastOne: "Add at least one segment.", invalidRange: "Segment {number}: the time range is invalid.",
    cutting: "Processing audio. Please wait…", cutFailure: "Could not export the audio.", downloadSingle: "↓ Download audio",
    downloadMultiple: "↓ Download ZIP ({count} segments)", cutComplete: "Exported {count} segments. Download the result below.",
    fileReady: "✓ {name} · {duration} · {size} MB",
  },
};
const t = (key, values = {}) => (messages[language][key] || key).replace(/\{(\w+)\}/g, (_, name) => values[name] ?? "");
const fmtTime = s => {
  if (!Number.isFinite(s)) return "00:00.00";
  const m=Math.floor(s/60), sec=s-m*60;
  return `${String(m).padStart(2,"0")}:${sec.toFixed(2).padStart(5,"0")}`;
};
const parseTime = v => {
  const p=String(v).trim().split(":").map(Number);
  if(p.some(x=>!Number.isFinite(x))) return NaN;
  return p.length===2?p[0]*60+p[1]:p.length===3?p[0]*3600+p[1]*60+p[2]:Number(v);
};
function status(msg,error=false){$("status").textContent=msg;$("status").classList.toggle("error",error);}
function translatedStatus(key,values={},error=false){
  statusTranslation={key,values,error};
  status(t(key,values),error);
}
function applyLanguage(){
  document.documentElement.lang=language;
  document.querySelectorAll("[data-i18n]").forEach(el=>{
    const key=el.dataset.i18n;
    if(messages[language][key])el.textContent=messages[language][key];
  });
  document.querySelectorAll("[data-i18n-aria-label]").forEach(el=>{
    const key=el.dataset.i18nAriaLabel;
    if(messages[language][key])el.setAttribute("aria-label",messages[language][key]);
  });
  document.title=t("pageTitle");
  if(statusTranslation)status(t(statusTranslation.key,statusTranslation.values),statusTranslation.error);
  if(job&&$("video").files[0]){
    const file=$("video").files[0];
    $("fileInfo").textContent=t("fileReady",{name:file.name,duration:fmtTime(duration),size:(file.size/1024/1024).toFixed(1)});
  }
  if(completedSegmentCount!==null){
    $("download").textContent=completedSegmentCount===1?t("downloadSingle"):t("downloadMultiple",{count:completedSegmentCount});
  }
  render();
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function render(){
  const root=$("segments"); root.innerHTML="";
  if(!segments.length){root.innerHTML=`<div class="empty">${t("noSegments")}</div>`;renderTimeline();return;}
  segments.forEach((s,i)=>{
    const el=document.createElement("div");el.className="segment";
    el.innerHTML=`<div class="number">${String(i+1).padStart(2,"0")}</div>
      <div class="field"><label>${t("segmentName")}</label><input data-i="${i}" data-k="name" value="${escapeHtml(s.name)}"></div>
      <div class="field"><label>${t("startSeconds")}</label><input type="number" min="0" step="0.01" data-i="${i}" data-k="start" value="${Number(s.start).toFixed(2)}"></div>
      <div class="field"><label>${t("endSeconds")}</label><input type="number" min="0" step="0.01" data-i="${i}" data-k="end" value="${Number(s.end).toFixed(2)}"></div>
      <button class="remove" data-remove="${i}" title="${t("removeSegment")}">×</button>`;
    root.appendChild(el);
  });
  root.querySelectorAll("input").forEach(input=>input.addEventListener("change",e=>{
    const i=+e.target.dataset.i,k=e.target.dataset.k;
    segments[i][k]=k==="name"?e.target.value:Number(e.target.value);
    selected=i; renderTimeline();
  }));
  root.querySelectorAll("[data-remove]").forEach(b=>b.addEventListener("click",()=>{
    const i=+b.dataset.remove;segments.splice(i,1);selected=Math.max(0,Math.min(selected,segments.length-1));render();
  }));
  renderTimeline();
}
function renderTimeline(){
  const scroll=$("timelineScroll"), track=$("timelineTrack"), ruler=$("timelineRuler"), selection=$("timelineSelection");
  if(!duration||!segments.length){track.style.width="100%";ruler.style.width="100%";selection.style.display="none";return;}
  const s=segments[selected];if(!s)return;
  pxPerSecond=2*zoom;
  const width=Math.max(scroll.clientWidth,duration*pxPerSecond);
  track.style.width=width+"px";ruler.style.width=width+"px";
  selection.style.display="block";
  selection.style.left=(s.start*pxPerSecond)+"px";
  selection.style.width=Math.max(2,(s.end-s.start)*pxPerSecond)+"px";
  $("timelineStart").textContent=s.start.toFixed(2)+"s";
  $("timelineEnd").textContent=s.end.toFixed(2)+"s";
  $("timelineLength").textContent=(s.end-s.start).toFixed(2)+"s";
  $("zoomValue").textContent=zoom+"×";
  ruler.innerHTML="";
  const interval=niceInterval(90/pxPerSecond);
  for(let t=0;t<=duration;t+=interval){
    const tick=document.createElement("span");tick.className="ruler-tick";tick.style.left=(t*pxPerSecond)+"px";tick.textContent=fmtTime(t);ruler.appendChild(tick);
  }
}
function niceInterval(min){return [0.1,0.2,0.5,1,2,5,10,15,30,60,120,300,600].find(x=>x>=min)||1200;}
function updateFromTimeline(){
  const s=segments[selected];if(!s)return;
  $("timelineSelection").style.left=(s.start*pxPerSecond)+"px";
  $("timelineSelection").style.width=Math.max(2,(s.end-s.start)*pxPerSecond)+"px";
  $("timelineStart").textContent=s.start.toFixed(2)+"s";
  $("timelineEnd").textContent=s.end.toFixed(2)+"s";
  $("timelineLength").textContent=(s.end-s.start).toFixed(2)+"s";
  const inputs=$("segments").querySelectorAll("input");
  inputs.forEach(input=>{if(+input.dataset.i===selected&&input.dataset.k!=="name")input.value=Number(s[input.dataset.k]).toFixed(2);});
}
function setHandle(which,event){
  if(!segments.length)return;
  event.preventDefault();
  const handle=event.currentTarget, s=segments[selected];
  const startX=event.clientX, original=which==="start"?s.start:s.end;
  const move=e=>{
    const delta=(e.clientX-startX)/pxPerSecond;
    let value=Math.max(0,Math.min(duration,Math.round((original+delta)*100)/100));
    if(which==="start")s.start=Math.min(value,s.end-0.01);
    else s.end=Math.max(value,s.start+0.01);
    updateFromTimeline();
  };
  const up=()=>{window.removeEventListener("pointermove",move);window.removeEventListener("pointerup",up);};
  window.addEventListener("pointermove",move);window.addEventListener("pointerup",up);
}
$("handleStart").addEventListener("pointerdown",e=>setHandle("start",e));
$("handleEnd").addEventListener("pointerdown",e=>setHandle("end",e));
$("zoom").addEventListener("input",e=>{zoom=Number(e.target.value);renderTimeline();});
$("choose").onclick=()=>$("video").click();
$("video").addEventListener("change",()=>handleFile($("video").files[0]));
async function handleFile(file){
  if(!file)return;
  completedSegmentCount=null;
  $("download").classList.add("hidden");
  translatedStatus("uploading");
  const fd=new FormData();fd.append("video",file);
  try{
    const res=await fetch("/api/upload",{method:"POST",body:fd});const data=await res.json();
    if(!res.ok)throw Error(data.error||t("uploadFailure"));
    job=data.job;duration=data.duration;
    video.src=URL.createObjectURL(file);video.style.display="block";$("emptyPreview").style.display="none";
    $("fileInfo").classList.remove("hidden");$("fileInfo").textContent=t("fileReady",{name:file.name,duration:fmtTime(duration),size:(file.size/1024/1024).toFixed(1)});
    $("duration").textContent=fmtTime(duration);$("add").disabled=false;$("cut").disabled=false;
    $("setStart").disabled=false;$("setEnd").disabled=false;
    segments=[{name:t("addSegmentName",{number:1}),start:0,end:Math.min(30,duration)}];selected=0;zoom=1;$("zoom").value=1;render();
    translatedStatus("videoReady");
  }catch(e){status(e.message||t("uploadFailure"),true);}
}
video.addEventListener("timeupdate",()=>{$("current").textContent=fmtTime(video.currentTime)});
$("add").onclick=()=>{segments.push({name:t("addSegmentName",{number:segments.length+1}),start:0,end:Math.min(30,duration)});selected=segments.length-1;render();};
$("setStart").onclick=()=>{if(!segments[selected])return;segments[selected].start=Math.min(video.currentTime,segments[selected].end-0.01);updateFromTimeline();};
$("setEnd").onclick=()=>{if(!segments[selected])return;segments[selected].end=Math.max(video.currentTime,segments[selected].start+0.01);updateFromTimeline();};
$("segments").addEventListener("focusin",e=>{const i=e.target.dataset.i;if(i!==undefined){selected=Number(i);renderTimeline();}});
$("cut").onclick=async()=>{
  if(!job)return;
  const normalized=segments.map(s=>({...s,start:Number(s.start),end:Number(s.end)}));
  if(!normalized.length){translatedStatus("atLeastOne",{},true);return;}
  for(let i=0;i<normalized.length;i++){const s=normalized[i];if(!Number.isFinite(s.start)||!Number.isFinite(s.end)||s.start<0||s.end<=s.start||s.end>duration+.05){translatedStatus("invalidRange",{number:i+1},true);return;}}
  $("cut").disabled=true;$("download").classList.add("hidden");translatedStatus("cutting");
  try{
    const res=await fetch("/api/cut",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({job,segments:normalized,format:$("format").value})});
    const data=await res.json();if(!res.ok)throw Error(data.error||t("cutFailure"));
    completedSegmentCount=data.count;
    $("download").href=data.download;$("download").classList.remove("hidden");
    $("download").textContent=data.count===1?t("downloadSingle"):t("downloadMultiple",{count:data.count});
    translatedStatus("cutComplete",{count:data.count});
  }catch(e){status(e.message||t("cutFailure"),true);}finally{$("cut").disabled=false;}
};
const drop=$("drop");
drop.addEventListener("dragover",e=>{e.preventDefault();drop.classList.add("drag")});
drop.addEventListener("dragleave",()=>drop.classList.remove("drag"));
drop.addEventListener("drop",e=>{e.preventDefault();drop.classList.remove("drag");handleFile(e.dataTransfer.files[0]);});
window.addEventListener("resize",()=>renderTimeline());
window.addEventListener("message",event=>{
  if(event.source!==window.parent||event.data?.type!=="app-preferences")return;
  const {theme,language:nextLanguage}=event.data;
  if(theme==="light"||theme==="dark")document.documentElement.dataset.theme=theme;
  if(nextLanguage==="vi"||nextLanguage==="en"){
    language=nextLanguage;
    applyLanguage();
  }
});
applyLanguage();
