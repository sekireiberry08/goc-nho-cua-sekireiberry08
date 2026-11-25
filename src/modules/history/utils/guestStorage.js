const GUEST_KEY = "lsd_guest_id";
const PROGRESS_KEY = "lsd_study_progress";

export const getOrCreateGuestId = () => {
  let id = localStorage.getItem(GUEST_KEY);
  if (!id) {
    id = "BK-" + Math.random().toString(36).substring(2, 8).toUpperCase();
    localStorage.setItem(GUEST_KEY, id);
  }
  return id;
};

export const getProgress = () => {
  const data = localStorage.getItem(PROGRESS_KEY);
  return data
    ? JSON.parse(data)
    : { completedIds: [], wrongIds: [], timelineScores: {} };
};

export const saveQuizResult = (questionId, isCorrect) => {
  const progress = getProgress();
  if (!progress.completedIds.includes(questionId)) {
    progress.completedIds.push(questionId);
  }
  if (!isCorrect && !progress.wrongIds.includes(questionId)) {
    progress.wrongIds.push(questionId);
  } else if (isCorrect) {
    progress.wrongIds = progress.wrongIds.filter((id) => id !== questionId);
  }
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  return progress;
};

export const exportProgressJson = () => {
  const payload = {
    guestId: getOrCreateGuestId(),
    progress: getProgress(),
    exportedAt: new Date().toISOString(),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `tien_do_lsd_${payload.guestId}.json`;
  a.click();
};
