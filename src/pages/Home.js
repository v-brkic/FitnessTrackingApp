// src/pages/Home.js
import React, { useMemo, useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import BottomNav from "../components/BottomNav";
import ProgressDashboard from "../components/ProgressDashboard";
import Modal from "../components/Modal";
import {
  subscribeProgressPhotos,
  addProgressPhotoFromFile,
  deleteProgressPhoto,
} from "../store/photosCloud";
import {
  subscribeWeights,
  addWeight as addWeightCloud,
  deleteWeight as deleteWeightCloud,
} from "../store/weightsCloud";

/* helpers */
const toIsoDate = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, "0");
  const day = String(x.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};
const fmtUiDate = (iso) => {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}.`;
};
const fmtTickDate = (iso) => {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}.${mm}.`;
};

const readFileAsDataURL = (file) =>
  new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = (e) => resolve(e.target.result);
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });

/* ==== Mini chart for Bodyweight section ==== */
function WeightChart({ data }) {
  const { viewBox, points, dots, yTicks, xTicks, lastLabel } = useMemo(() => {
    const w = 340,
      h = 170,
      padL = 40,
      padR = 12,
      padT = 14,
      padB = 26;
    const vb = `0 0 ${w} ${h}`;
    if (!data?.length)
      return {
        viewBox: vb,
        points: "",
        dots: [],
        yTicks: [],
        xTicks: [],
        lastLabel: null,
      };

    const xs = data.map((d) => new Date(d.date).getTime());
    const ys = data.map((d) => d.kg);
    const minX = Math.min(...xs),
      maxX = Math.max(...xs);
    const minY = Math.min(...ys),
      maxY = Math.max(...ys);
    const spanX = Math.max(1, maxX - minX);
    const spanY = Math.max(1, maxY - minY) || 1;
    const sx = (t) => padL + ((t - minX) / spanX) * (w - padL - padR);
    const sy = (y) =>
      h - padB - ((y - minY) / spanY) * (h - padT - padB);

    const pts = data
      .map((d) => `${sx(new Date(d.date).getTime())},${sy(d.kg)}`)
      .join(" ");
    const circles = data.map((d) => ({
      cx: sx(new Date(d.date).getTime()),
      cy: sy(d.kg),
      val: d.kg,
      date: d.date,
    }));

    const y1 = +minY.toFixed(1),
      y3 = +maxY.toFixed(1),
      y2 = +((minY + maxY) / 2).toFixed(1);
    const uniqY = [y1, y2, y3].filter((v, i, arr) => arr.indexOf(v) === i);
    const yTickVals = uniqY.map((v) => ({ y: sy(v), label: `${v} kg` }));

    const minGap = 56;
    const xTickObjs = [];
    let lastX = -Infinity;
    for (let i = 0; i < data.length; i++) {
      const x = sx(new Date(data[i].date).getTime());
      const isEdge = i === 0 || i === data.length - 1;
      if (isEdge || x - lastX >= minGap) {
        xTickObjs.push({ x, label: fmtTickDate(data[i].date) });
        lastX = x;
      }
    }

    const last = circles[circles.length - 1];
    let lx = last.cx + 6,
      ly = last.cy - 6;
    lx = Math.min(Math.max(lx, padL + 4), w - padR - 32);
    ly = Math.min(Math.max(ly, padT + 10), h - padB - 6);
    const ll = { x: lx, y: ly, text: `${last.val} kg` };

    return {
      viewBox: vb,
      points: pts,
      dots: circles,
      yTicks: yTickVals,
      xTicks: xTickObjs,
      lastLabel: ll,
    };
  }, [data]);

  return (
    <div className="chart-wrap">
      <svg viewBox={viewBox} className="chart" aria-label="Weight chart">
        {yTicks.map((t, i) => (
          <g key={`yt-${i}`}>
            <line x1="0" x2="100%" y1={t.y} y2={t.y} className="grid" />
            <text x="8" y={t.y - 1} className="chart-axis-text">
              {t.label}
            </text>
          </g>
        ))}
        <line x1="0" y1="138" x2="100%" y2="138" className="axis-line" />
        {xTicks.map((t, i) => (
          <g key={`xt-${i}`}>
            <line
              x1={t.x}
              y1="138"
              x2={t.x}
              y2="142"
              className="axis-line"
            />
            <text
              x={t.x}
              y="162"
              textAnchor="middle"
              className="chart-axis-text"
            >
              {t.label}
            </text>
          </g>
        ))}
        {points ? (
          <polyline
            fill="none"
            strokeWidth="2.5"
            className="chart-line"
            points={points}
          />
        ) : null}
        {dots.map((d, i) => (
          <circle
            key={`d-${i}`}
            cx={d.cx}
            cy={d.cy}
            r="2.5"
            className="chart-dot"
          />
        ))}
        {lastLabel ? (
          <text
            x={lastLabel.x}
            y={lastLabel.y}
            className="chart-value-label"
          >
            {lastLabel.text}
          </text>
        ) : null}
      </svg>
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();

  // === TAB: "bodyweight" | "progress"
  const [tab, setTab] = useState("bodyweight");

  // === Bodyweight form
  const [date, setDate] = useState(() => toIsoDate(new Date()));
  const [kg, setKg] = useState("");

  // === CLOUD weights + LOCAL chart data
  const [weightsCloudRows, setWeightsCloudRows] = useState([]); // [{id, kg, date: Date}]
  const [weightsLocal, setWeightsLocal] = useState([]); // [{date, kg}]

  // === Photos
  const [photos, setPhotos] = useState([]);
  const [lightbox, setLightbox] = useState(null);

  // === Add photo modal (caption + date)
  const [photoModalOpen, setPhotoModalOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const [pendingPreview, setPendingPreview] = useState("");
  const [photoCaption, setPhotoCaption] = useState("");
  const [photoDate, setPhotoDate] = useState(() => toIsoDate(new Date()));

  const closePhotoModal = () => {
    setPhotoModalOpen(false);
    setPendingFile(null);
    setPendingPreview("");
    setPhotoCaption("");
    setPhotoDate(toIsoDate(new Date()));
  };

  const onPickPhoto = async (file) => {
    if (!file) return;
    setPendingFile(file);
    setPhotoCaption("");
    setPhotoDate(toIsoDate(new Date()));
    try {
      const preview = await readFileAsDataURL(file);
      setPendingPreview(preview);
    } catch {
      setPendingPreview("");
    }
    setPhotoModalOpen(true);
  };

  const savePickedPhoto = async () => {
    if (!pendingFile) return;
    try {
      await addProgressPhotoFromFile(pendingFile, {
        dateIso: photoDate || toIsoDate(new Date()),
        caption: (photoCaption || "").trim(),
      });
      closePhotoModal();
    } catch (e) {
      console.error(e);
      alert("Upload failed.");
    }
  };

  // subscribe photos
  useEffect(() => {
    let unsub;
    try {
      unsub = subscribeProgressPhotos(setPhotos);
    } catch (e) {
      console.warn(e);
    }
    return () => unsub && unsub();
  }, []);

  // subscribe weights
  useEffect(() => {
    const unsub = subscribeWeights((serverRows) => {
      setWeightsCloudRows(serverRows);
      const normalized = serverRows
        .map((r) => ({ date: toIsoDate(r.date), kg: Number(r.kg) }))
        .sort((a, b) => a.date.localeCompare(b.date));
      setWeightsLocal(normalized);
    });
    return () => unsub && unsub();
  }, []);

  // save weight
  const addWeight = async () => {
    const raw = String(kg).trim().replace(",", ".");
    const val = parseFloat(raw);
    if (!date || !isFinite(val) || val <= 0) return;
    try {
      await addWeightCloud({ kg: Number(val.toFixed(1)), date: new Date(date) });
      setKg("");
    } catch (e) {
      console.error(e);
      alert("Couldn't save weight.");
    }
  };

  // delete weight
  const onDeleteOneCloud = async (id) => {
    try {
      await deleteWeightCloud(id);
    } catch (e) {
      console.error(e);
      alert("Couldn't delete entry.");
    }
  };

  // chart range
  const [range, setRange] = useState("month"); // week | month | all

  const currentWeight = useMemo(() => {
    if (!weightsLocal.length) return null;
    return Number(weightsLocal[weightsLocal.length - 1].kg).toFixed(1);
  }, [weightsLocal]);

  const filteredData = useMemo(() => {
    if (!weightsLocal.length) return [];
    if (range === "all") return weightsLocal;

    const now = new Date();
    let from = new Date(now);
    if (range === "week") from.setDate(now.getDate() - 6);
    if (range === "month") from.setMonth(now.getMonth() - 1);

    return weightsLocal.filter((d) => new Date(d.date) >= from);
  }, [weightsLocal, range]);

  // carousel helpers
  const trackRef = useRef(null);
  const scrollByDir = (dir) => {
    const el = trackRef.current;
    if (!el) return;
    const delta = el.clientWidth * 0.9;
    el.scrollBy({ left: dir * delta, behavior: "smooth" });
  };

  // lightbox esc
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e) => {
      if (e.key === "Escape") setLightbox(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  return (
    <>
      <div className="container page home">
        {/* HERO */}
        <section
          className="home-hero"
          style={{
            display: "grid",
            placeItems: "center",
            paddingTop: 24,
            paddingBottom: 8,
          }}
        >

          <div className="logo-stack" style={{ display: "grid", placeItems: "center" }}>
            <div>
              <img
                src="/brkicLogo.png"
                alt="Logo"
                style={{ width: 32, height: 32, objectFit: "contain" }}
              />
            </div>
          </div>
          <h1
            className="home-title"
            style={{ margin: "1px 0 8px", fontSize: 28, fontWeight: 800 }}
          >
            Your progress
          </h1>

          {/* Sticky switch */}
          <div className="seg-control seg-sticky" role="tablist" aria-label="Progress tabs">
            <button
              className={`seg ${tab === "progress" ? "active" : ""}`}
              role="tab"
              aria-selected={tab === "progress"}
              onClick={() => setTab("progress")}
            >
              Progress
            </button>
            <button
              className={`seg ${tab === "bodyweight" ? "active" : ""}`}
              role="tab"
              aria-selected={tab === "bodyweight"}
              onClick={() => setTab("bodyweight")}
            >
              Bodyweight
            </button>
          </div>
        </section>

        {/* TAB CONTENT */}
        {tab === "bodyweight" ? (
          <>
            {/* === BODYWEIGHT PANEL === */}
            <section className="card seamless">
              <div className="panel-block">
                <div className="panel-head">
                  <div className="pp-title" style={{ fontSize: 18, fontWeight: 700 }}>
                    Bodyweight
                  </div>
                  <div className="bw-range">
                    <button
                      className={`range-btn chip ${range === "week" ? "active" : ""}`}
                      onClick={() => setRange("week")}
                    >
                      Week
                    </button>
                    <button
                      className={`range-btn chip ${range === "month" ? "active" : ""}`}
                      onClick={() => setRange("month")}
                    >
                      Month
                    </button>
                    <button
                      className={`range-btn chip ${range === "all" ? "active" : ""}`}
                      onClick={() => setRange("all")}
                    >
                      All
                    </button>
                  </div>
                </div>

                <div className="panel-body">
                  <div
                    className="bw-row"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <div className="bw-current">
                      {currentWeight ? (
                        <>
                          <span className="num" style={{ fontSize: 34, fontWeight: 800 }}>
                            {currentWeight}
                          </span>{" "}
                          <span className="unit" style={{ opacity: 0.9 }}>
                            kg
                          </span>
                        </>
                      ) : (
                        "—"
                      )}
                      <div className="bw-sub muted">Current weight</div>
                    </div>
                    <button
                      className="btn-ghost add-track"
                      onClick={() => document.getElementById("kg-input")?.focus()}
                    >
                      + Add tracking
                    </button>
                  </div>

                  <div className="bw-form bw-form--fix">
  <div className="bw-form-row">
    <input
      className="input bw-date"
      type="date"
      value={date}
      onChange={(e) => setDate(e.target.value)}
      aria-label="Date"
    />

    <input
      id="kg-input"
      className="input bw-kg"
      type="text"
      inputMode="decimal"
      pattern="[0-9]*[.,]?[0-9]+"
      value={kg}
      onChange={(e) => setKg(e.target.value)}
      placeholder="e.g. 82.4"
      aria-label="Weight in kg"
    />
  </div>

  <button className="btn-primary save" onClick={addWeight} style={{ height: 48 }}>
    Save
  </button>
</div>



                </div>

                <div style={{ padding: "0 8px 8px" }}>
                  <WeightChart data={filteredData} />
                </div>
              </div>
            </section>

            {/* === PROGRESS PHOTOS PANEL === */}
            <section className="card seamless pp-panel">
              <div className="panel-block">
                <div className="pp-head panel-head">
                  <div>
                    <div className="pp-title" style={{ fontSize: 18, fontWeight: 700 }}>
                      Progress Photos
                    </div>
                    <div className="pp-sub muted">Hard work pays off</div>
                  </div>

                  <label className="btn-ghost" style={{ cursor: "pointer" }}>
                    + Add
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        onPickPhoto(f);
                      }}
                      style={{ display: "none" }}
                    />
                  </label>
                </div>

                <div className="panel-body" style={{ paddingTop: 0 }}>
                  <div className="progress-carousel">
                    <button className="pc-arrow left" aria-label="Prev" onClick={() => scrollByDir(-1)}>
                      ‹
                    </button>

                    <div className="pc-track" ref={trackRef}>
                      {photos.map((ph) => (
                        <div key={ph.id} className="pc-item">
                          <div
                            className="ph-tile"
                            style={{ position: "relative", overflow: "hidden", cursor: "zoom-in" }}
                            onClick={() => setLightbox({ src: ph.dataURL, caption: ph.caption || "", date: ph.date || "" })}
                          >
                            <img
                              src={ph.dataURL}
                              alt=""
                              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                            />
                            {ph.date ? (
                              <div
                                style={{
                                  position: "absolute",
                                  top: 6,
                                  left: 6,
                                  fontSize: 12,
                                  color: "#cbd5e1",
                                  background: "rgba(0,0,0,.35)",
                                  padding: "2px 6px",
                                  borderRadius: 8,
                                }}
                              >
                                {ph.date}
                              </div>
                            ) : null}

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteProgressPhoto(ph.id);
                              }}
                              className="icon-btn danger"
                              title="Delete"
                              style={{ position: "absolute", top: 6, right: 6 }}
                            >
                              🗑
                            </button>
                          </div>
                          <div className="ph-caption">{ph.caption || "—"}</div>
                        </div>
                      ))}

                      {/* Add tile */}
                      <label className="pc-item add">
                        <div className="ph-tile" style={{ display: "grid", placeItems: "center", position: "relative" }}>
                          + Add
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              e.target.value = "";
                              onPickPhoto(f);
                            }}
                            style={{ display: "none" }}
                          />
                        </div>
                        <div className="ph-caption muted">Upload a progress photo</div>
                      </label>
                    </div>

                    <button className="pc-arrow right" aria-label="Next" onClick={() => scrollByDir(1)}>
                      ›
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </>
        ) : (
          /* === PROGRESS DASHBOARD TAB === */
          <ProgressDashboard weights={weightsLocal} onBackToBodyweight={() => setTab("bodyweight")} />
        )}
      </div>

      {/* ADD PHOTO MODAL (caption + date) */}
      <Modal
        open={photoModalOpen}
        onClose={closePhotoModal}
        title="Add progress photo"
        footer={
          <div className="modal-actions">
            <button className="btn-ghost" onClick={closePhotoModal}>
              Cancel
            </button>
            <button className="btn-primary" onClick={savePickedPhoto} disabled={!pendingFile}>
              Save
            </button>
          </div>
        }
      >
        <div className="form-row">
          <label>Date</label>
          <input className="input" type="date" value={photoDate} onChange={(e) => setPhotoDate(e.target.value)} />
        </div>

        <div className="form-row">
          <label>Description</label>
          <input
            className="input"
            type="text"
            placeholder="e.g. Week 6 – feeling stronger"
            value={photoCaption}
            onChange={(e) => setPhotoCaption(e.target.value)}
          />
        </div>

        {pendingPreview ? (
          <div className="img-preview" style={{ marginTop: 10 }}>
            <img src={pendingPreview} alt="Preview" />
          </div>
        ) : null}
      </Modal>

      {/* LIGHTBOX */}
      {lightbox && (
        <div className="lightbox" onClick={() => setLightbox(null)} role="dialog" aria-label="Image preview">
          <img src={lightbox.src} alt="" className="lightbox-img" />
          {lightbox.caption || lightbox.date ? (
            <div className="lightbox-caption">
              {lightbox.date ? <strong style={{ marginRight: 8 }}>{fmtUiDate(lightbox.date)}</strong> : null}
              {lightbox.caption}
            </div>
          ) : null}
          <button className="lightbox-close" onClick={() => setLightbox(null)} title="Close">
            ✕
          </button>
        </div>
      )}

      <BottomNav />
    </>
  );
}
