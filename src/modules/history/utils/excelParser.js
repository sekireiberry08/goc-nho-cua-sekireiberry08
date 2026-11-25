import * as XLSX from "xlsx";

export const loadExcelData = async (
  fileUrl = "/data/data_lich_su_dang.xlsx",
) => {
  const response = await fetch(fileUrl);
  const arrayBuffer = await response.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: "array" });

  const trongTam = XLSX.utils.sheet_to_json(workbook.Sheets["Trong_Tam"] || {});
  const timeline = XLSX.utils.sheet_to_json(workbook.Sheets["Timeline"] || {});
  const cauHoi = XLSX.utils.sheet_to_json(
    workbook.Sheets["Ngan_Hang_Cau_Hoi"] || {},
  );

  return { trongTam, timeline, cauHoi };
};
