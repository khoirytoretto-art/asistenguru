import React from 'react';
import { School, ClassJournalEntry, PaperSize } from '../../types';
import { StorageService, normalizeDateString } from '../../utils/storage';

interface PrintableJournalSheetProps {
  id?: string;
  school: School;
  classId?: string;
  className?: string;
  journals: ClassJournalEntry[];
  periodeText: string;
  paperSize?: PaperSize;
  selectedMonth?: number;
}

export const PrintableJournalSheet: React.FC<PrintableJournalSheetProps> = ({
  id = 'journal-print-document',
  school,
  classId,
  className,
  journals,
  periodeText,
  paperSize = 'F4',
  selectedMonth,
}) => {
  const foundation = StorageService.getFoundation();
  const schoolClasses = StorageService.getClasses(school.id);
  const classObj = schoolClasses.find(
    (c) => (classId && c.id === classId) || (className && (c.name.toLowerCase() === className.toLowerCase() || c.id === className))
  );
  const displayClassName = classObj
    ? classObj.name
    : (className || (schoolClasses.length > 0 ? schoolClasses[0].name : 'Kelas'));
  const effectiveClassId = classObj
    ? classObj.id
    : (classId || (schoolClasses.length > 0 ? schoolClasses[0].id : ''));

  const todayFormatted = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const sig = school.signatureConfig || {
    tampilkanTandaTangan: true,
    pihak1Aktif: true,
    pihak1Label: 'Mengetahui,',
    pihak1Jabatan: 'Kepala Sekolah',
    pihak1Nama: school.kepalaSekolah,
    pihak1Nip: school.nipKepalaSekolah,
    pihak2Aktif: true,
    pihak2Label: 'Disahkan di Riau,',
    pihak2Jabatan: 'Waka Kurikulum / Wali Kelas',
    pihak2Nama: school.wakaKurikulum || 'Wali Kelas',
    pihak2Nip: school.nipWakaKurikulum,
    lokasiKota: 'Riau',
  };

  const isF4 = paperSize === 'F4';
  const containerMinWidth = isF4 ? '1140px' : '990px';

  // Tampilan Semester Sesuai Ketentuan Resmi:
  // Bulan Juli - Desember = Semester Ganjil
  // Bulan Januari - Juni = Semester Genap
  const firstDateInfo = journals.length > 0 && journals[0].date ? normalizeDateString(journals[0].date) : null;
  const derivedMonth = selectedMonth || (firstDateInfo ? firstDateInfo.month : new Date().getMonth() + 1);
  const semesterLabel = derivedMonth >= 7 && derivedMonth <= 12 ? 'Semester Ganjil' : 'Semester Genap';

  // Jurnal pembelajaran kelas WAJIB PER-KELAS
  const studyJournals = journals.filter((j) => {
    // Wajib sesuai kelas masing-masing
    if (!j.classId) return false;
    const jc = j.classId.trim().toLowerCase();
    const matchId = effectiveClassId ? jc === effectiveClassId.toLowerCase() : false;
    const matchName = displayClassName ? jc === displayClassName.toLowerCase() : false;
    const matchRawName = className ? jc === className.trim().toLowerCase() : false;
    const matchClean = displayClassName ? jc.replace(/\s+/g, '') === displayClassName.toLowerCase().replace(/\s+/g, '') : false;
    return matchId || matchName || matchRawName || matchClean;
  });

  // Urutkan rekaman jurnal pembelajaran:
  // 1. Tanggal dimulai dari yang terlama (ascending: tanggal terlama ke tanggal terbaru)
  // 2. Jam ke- nya dimulai dari 1 (ascending: 1, 2, 3...)
  const sortedJournals = [...studyJournals].sort((a, b) => {
    const infoA = normalizeDateString(a.date);
    const infoB = normalizeDateString(b.date);
    const dateA = infoA ? infoA.formatted : (a.date || '');
    const dateB = infoB ? infoB.formatted : (b.date || '');
    if (dateA !== dateB) {
      return dateA.localeCompare(dateB);
    }
    const jamA = typeof a.jamKe === 'number' ? a.jamKe : parseInt(String(a.jamKe || 0), 10);
    const jamB = typeof b.jamKe === 'number' ? b.jamKe : parseInt(String(b.jamKe || 0), 10);
    return jamA - jamB;
  });

  return (
    <div
      id={id}
      className="printable-area bg-white text-black p-3 sm:p-4 font-sans mx-auto"
      style={{
        width: '100%',
        minWidth: containerMinWidth,
        backgroundColor: '#ffffff',
        color: '#000000',
        boxSizing: 'border-box',
      }}
    >
      {/* KOP RESMI: LOGO YAYASAN DI KIRI & LOGO SEKOLAH DI KANAN */}
      <div className="border-b-4 border-double border-slate-900 pb-3 mb-4">
        <div className="flex items-center justify-between gap-4">
          {/* LOGO YAYASAN (SEBELAH KIRI) */}
          <div className="w-20 h-20 flex items-center justify-center shrink-0">
            {foundation.logoYayasanUrl ? (
              <img
                src={foundation.logoYayasanUrl}
                alt="Logo Yayasan"
                className="w-20 h-20 object-contain rounded p-0.5"
                crossOrigin="anonymous"
              />
            ) : (
              <div className="w-16 h-16 bg-slate-100 flex items-center justify-center font-bold text-xs text-slate-700 border border-slate-300 rounded text-center leading-tight">
                LOGO<br />YAYASAN
              </div>
            )}
          </div>

          {/* TEKS KOP TENGAH */}
          <div className="flex-1 text-center px-2">
            <h4 className="text-xs uppercase tracking-wider font-semibold text-slate-800">
              {school.foundationName || foundation.name}
            </h4>
            <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-slate-950 mt-0.5">
              {school.name}
            </h1>
            <p className="text-xs font-semibold text-slate-800 mt-0.5">
              NPSN: {school.npsn} &bull; Status Akreditasi: <strong>{school.akreditasi}</strong>
            </p>
            <p className="text-[11px] text-slate-600 mt-0.5">
              {school.alamat} &bull; Telp: {school.telepon} &bull; Email: {school.email}
            </p>
          </div>

          {/* LOGO SEKOLAH (SEBELAH KANAN) */}
          <div className="w-20 h-20 flex items-center justify-center shrink-0">
            {school.logoUrl ? (
              <img
                src={school.logoUrl}
                alt="Logo Sekolah"
                className="w-20 h-20 object-contain rounded p-0.5"
                crossOrigin="anonymous"
              />
            ) : (
              <div className="w-16 h-16 bg-slate-100 flex items-center justify-center font-bold text-xs text-slate-700 border border-slate-300 rounded text-center leading-tight">
                LOGO<br />SEKOLAH
              </div>
            )}
          </div>
        </div>
      </div>

      {/* JUDUL REKAP JURNAL KELAS */}
      <div className="text-center mb-4">
        <h2 className="text-base sm:text-lg font-bold underline tracking-wide uppercase text-slate-950">
          REKAP JURNAL PEMBELAJARAN KELAS
        </h2>
        <div className="flex justify-between items-center text-xs font-semibold mt-2 px-1 text-slate-800">
          <div>
            <span>Kelas: </span>
            <span className="font-bold text-indigo-950 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
              {displayClassName}
            </span>
          </div>
          <div>
            <span>Periode: </span>
            <span className="font-bold">{periodeText}</span>
          </div>
          <div>
            <span>Tahun Ajaran: </span>
            <span className="font-bold">{school.tahunAjaranAktif || '2024/2025'} ({semesterLabel})</span>
          </div>
          <div className="text-[10px] text-slate-600 font-mono">
            Ukuran Kertas: <strong>{paperSize === 'F4' ? 'F4 / Folio (330x215mm)' : 'A4 (297x210mm)'}</strong>
          </div>
        </div>
      </div>

      {/* TABEL JURNAL KELAS */}
      <div className="w-full">
        <table
          className="w-full text-left border-collapse text-xs"
          style={{
            border: '1px solid #0f172a',
            width: '100%',
          }}
        >
          <thead>
            <tr style={{ backgroundColor: '#f1f5f9', color: '#0f172a' }}>
              <th style={{ border: '1px solid #0f172a', padding: '6px 4px', textAlign: 'center', width: '36px' }}>No</th>
              <th style={{ border: '1px solid #0f172a', padding: '6px 8px', width: '130px' }}>Hari / Tanggal</th>
              <th style={{ border: '1px solid #0f172a', padding: '6px 4px', textAlign: 'center', width: '60px' }}>Jam Ke</th>
              <th style={{ border: '1px solid #0f172a', padding: '6px 8px', width: isF4 ? '200px' : '170px' }}>Mata Pelajaran</th>
              <th style={{ border: '1px solid #0f172a', padding: '6px 8px', width: isF4 ? '200px' : '170px' }}>Nama Guru</th>
              <th style={{ border: '1px solid #0f172a', padding: '6px 8px' }}>Materi Pembelajaran</th>
              <th style={{ border: '1px solid #0f172a', padding: '6px 8px', textAlign: 'center', width: '110px' }}>Jenis Kegiatan</th>
              <th style={{ border: '1px solid #0f172a', padding: '6px 8px', textAlign: 'center', width: '110px' }}>Keterangan</th>
              <th style={{ border: '1px solid #0f172a', padding: '6px 4px', textAlign: 'center', width: '65px' }}>Paraf</th>
            </tr>
          </thead>
          <tbody>
            {sortedJournals.length === 0 ? (
              <tr>
                <td
                  colSpan={9}
                  style={{
                    border: '1px solid #0f172a',
                    padding: '30px',
                    textAlign: 'center',
                    color: '#64748b',
                    fontStyle: 'italic',
                  }}
                >
                  Belum ada rekaman jurnal pembelajaran untuk kelas {className || ''} pada periode ini.
                </td>
              </tr>
            ) : (
              sortedJournals.map((j, idx) => {
                const dateInfo = normalizeDateString(j.date);
                let dayName = '-';
                let formattedDate = j.date || '-';
                if (dateInfo) {
                  const dateObj = new Date(dateInfo.year, dateInfo.month - 1, dateInfo.day);
                  dayName = dateObj.toLocaleDateString('id-ID', { weekday: 'long' });
                  formattedDate = dateObj.toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  });
                }

                return (
                  <tr
                    key={j.id}
                    style={{
                      pageBreakInside: 'avoid',
                      breakInside: 'avoid',
                      backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f8fafc',
                    }}
                  >
                    <td style={{ border: '1px solid #0f172a', padding: '6px 4px', textAlign: 'center', verticalAlign: 'top', fontWeight: 'bold' }}>
                      {idx + 1}
                    </td>
                    <td style={{ border: '1px solid #0f172a', padding: '6px 8px', verticalAlign: 'top' }}>
                      <div className="font-semibold text-slate-900">{dayName}</div>
                      <div className="text-[11px] text-slate-600">{formattedDate}</div>
                    </td>
                    <td style={{ border: '1px solid #0f172a', padding: '6px 4px', textAlign: 'center', verticalAlign: 'top', fontWeight: 'bold' }}>
                      {j.jamKe}
                    </td>
                    <td style={{ border: '1px solid #0f172a', padding: '6px 8px', verticalAlign: 'top', wordBreak: 'break-word' }}>
                      <span className="font-semibold text-slate-900">{j.subjectName || 'Pembelajaran'}</span>
                    </td>
                    <td style={{ border: '1px solid #0f172a', padding: '6px 8px', verticalAlign: 'top', wordBreak: 'break-word' }}>
                      <div className="font-medium text-slate-900">{j.teacherName}</div>
                    </td>
                    <td style={{ border: '1px solid #0f172a', padding: '6px 8px', verticalAlign: 'top', wordBreak: 'break-word' }}>
                      <p className="text-slate-900 leading-snug">{j.materi}</p>
                      {j.catatan && (
                        <p className="text-[11px] text-slate-500 italic mt-0.5">Catatan: {j.catatan}</p>
                      )}
                    </td>
                    <td style={{ border: '1px solid #0f172a', padding: '6px 8px', textAlign: 'center', verticalAlign: 'top' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '10px',
                          fontWeight: 'bold',
                          backgroundColor: j.jenisKegiatan === 'KBM' ? '#e0e7ff' : '#fef3c7',
                          color: j.jenisKegiatan === 'KBM' ? '#3730a3' : '#92400e',
                        }}
                      >
                        {j.jenisKegiatan}
                      </span>
                    </td>
                    <td style={{ border: '1px solid #0f172a', padding: '6px 8px', textAlign: 'center', verticalAlign: 'top' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '10px',
                          fontWeight: 'bold',
                          backgroundColor: j.keterangan === 'Tuntas' ? '#dcfce7' : '#fee2e2',
                          color: j.keterangan === 'Tuntas' ? '#166534' : '#991b1b',
                        }}
                      >
                        {j.keterangan}
                      </span>
                    </td>
                    <td style={{ border: '1px solid #0f172a', padding: '6px 4px', textAlign: 'center', verticalAlign: 'top' }}>
                      <div className="w-8 h-7 border border-dashed border-slate-400 mx-auto rounded flex items-center justify-center text-[9px] text-slate-400 italic">
                        Paraf
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* CATATAN PENGESAHAN */}
      <div className="mt-3 flex justify-end text-[10px] text-slate-500 italic">
        <div>
          Dokumen Resmi AsistenGuru &bull; Format: {paperSize === 'F4' ? 'F4 / Folio (330mm)' : 'A4 (297mm)'} Landscape
        </div>
      </div>

      {/* LEMBAR PENGESAHAN TANDA TANGAN (HANYA MUNCUL JIKA AKTIF) */}
      {sig.tampilkanTandaTangan ? (
        <div
          className="signature-container mt-8 flex justify-between items-start text-xs text-slate-900 px-6"
          style={{
            pageBreakInside: 'avoid',
            breakInside: 'avoid',
          }}
        >
          {sig.pihak1Aktif ? (
            <div className="text-center w-64 flex flex-col items-center">
              <p className="text-slate-700 font-medium">{sig.pihak1Label || 'Mengetahui,'}</p>
              <p className="font-bold mt-0.5">{sig.pihak1Jabatan || 'Kepala Sekolah'}</p>
              {/* Ruang kosong tanda tangan & stempel fisik yang luas (90px) */}
              <div
                className="signature-space w-full"
                style={{
                  height: '90px',
                  minHeight: '90px',
                  display: 'block',
                }}
              />
              <p className="font-bold underline text-slate-900 text-sm tracking-wide">
                {sig.pihak1Nama || school.kepalaSekolah}
              </p>
              <p className="text-[11px] text-slate-600 mt-0.5">
                NIP: {sig.pihak1Nip || school.nipKepalaSekolah || '-'}
              </p>
            </div>
          ) : <div />}

          {sig.pihak2Aktif ? (
            <div className="text-center w-64 flex flex-col items-center">
              <p className="text-slate-700 font-medium">
                {sig.pakaiTanggal !== false
                  ? (sig.pihak2Label || `Disahkan di ${sig.lokasiKota || 'Riau'}, ${sig.tanggalManual || todayFormatted}`)
                  : (sig.pihak2Label || `Disahkan di ${sig.lokasiKota || 'Riau'}`)}
              </p>
              <p className="font-bold mt-0.5">{sig.pihak2Jabatan || 'Waka Kurikulum / Wali Kelas'}</p>
              {/* Ruang kosong tanda tangan fisik yang luas (90px) */}
              <div
                className="signature-space w-full"
                style={{
                  height: '90px',
                  minHeight: '90px',
                  display: 'block',
                }}
              />
              <p className="font-bold underline text-slate-900 text-sm tracking-wide">
                {sig.pihak2Nama || school.wakaKurikulum || 'Petugas'}
              </p>
              <p className="text-[11px] text-slate-600 mt-0.5">
                NIP: {sig.pihak2Nip || school.nipWakaKurikulum || '-'}
              </p>
            </div>
          ) : <div />}
        </div>
      ) : null}
    </div>
  );
};
