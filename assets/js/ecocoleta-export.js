

(function (global) {
  "use strict";

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  function timestamp() {
    var d = new Date();
    return (
      d.getFullYear() +
      pad2(d.getMonth() + 1) +
      pad2(d.getDate()) +
      "_" +
      pad2(d.getHours()) +
      pad2(d.getMinutes())
    );
  }

  function escapeCsvCell(val) {
    var s = String(val ?? "");
    if (/[",\n\r;]/.test(s)) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  function triggerDownload(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(url);
      a.remove();
    }, 400);
  }

  function downloadReport(filename, sections) {
    var lines = [];
    (sections || []).forEach(function (sec, idx) {
      if (idx > 0) {
        lines.push("");
      }
      if (sec.heading) {
        lines.push(escapeCsvCell(sec.heading));
      }
      if (sec.headers && sec.headers.length) {
        lines.push(sec.headers.map(escapeCsvCell).join(";"));
      }
      (sec.rows || []).forEach(function (row) {
        lines.push(
          row.map(function (cell) {
            return escapeCsvCell(cell);
          }).join(";")
        );
      });
    });

    var bom = "\uFEFF";
    var blob = new Blob([bom + lines.join("\r\n")], {
      type: "text/csv;charset=utf-8;",
    });
    var name = /\.csv$/i.test(filename) ? filename : filename + ".csv";
    triggerDownload(blob, name);
  }

  function downloadExcel(filename, sections) {
    downloadReport(filename.replace(/\.xlsx?$/i, "") + ".csv", sections);
  }

  function escHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function buildTableHtml(headers, rows) {
    var html =
      '<table><thead><tr>' +
      headers
        .map(function (h) {
          return "<th>" + escHtml(h) + "</th>";
        })
        .join("") +
      "</tr></thead><tbody>";
    (rows || []).forEach(function (row) {
      html +=
        "<tr>" +
        row
          .map(function (c) {
            return "<td>" + escHtml(c) + "</td>";
          })
          .join("") +
        "</tr>";
    });
    return html + "</tbody></table>";
  }

  function printPdf(opts) {
    var title = opts.title || "Relatório EcoColeta";
    var subtitle = opts.subtitle || "";
    var meta = opts.meta || [];
    var sections = opts.sections || [];

    var body = "";
    meta.forEach(function (pair) {
      body += "<p><strong>" + escHtml(pair[0]) + ":</strong> " + escHtml(pair[1]) + "</p>";
    });

    sections.forEach(function (sec) {
      body += "<h2>" + escHtml(sec.heading || "") + "</h2>";
      if (sec.headers && sec.rows) {
        body += buildTableHtml(sec.headers, sec.rows);
      }
      if (sec.html) {
        body += sec.html;
      }
    });

    var html =
      "<!DOCTYPE html><html lang=\"pt-BR\"><head><meta charset=\"utf-8\"><title>" +
      escHtml(title) +
      '</title><style>' +
      "body{font-family:Segoe UI,Arial,sans-serif;color:#0f2c21;padding:24px;font-size:13px;}" +
      "h1{font-size:20px;margin:0 0 4px;color:#0a3d2e;}" +
      ".sub{color:#5c766a;margin:0 0 16px;font-size:12px;}" +
      "h2{font-size:14px;margin:22px 0 8px;color:#0f6b4a;border-bottom:1px solid #d4e5dc;padding-bottom:4px;}" +
      "table{width:100%;border-collapse:collapse;margin-bottom:12px;}" +
      "th,td{border:1px solid #d4e5dc;padding:8px 10px;text-align:left;}" +
      "th{background:#e8f7ef;font-size:11px;text-transform:uppercase;letter-spacing:.04em;}" +
      "tr:nth-child(even) td{background:#fafcfb;}" +
      "@media print{body{padding:12px;}@page{margin:14mm;}}" +
      "</style></head><body>" +
      "<h1>" +
      escHtml(title) +
      "</h1>" +
      (subtitle ? '<p class="sub">' + escHtml(subtitle) + "</p>" : "") +
      body +
      '<p class="sub" style="margin-top:24px">Gerado em ' +
      escHtml(new Date().toLocaleString("pt-BR")) +
      " — EcoColeta</p></body></html>";

    var win = global.open("", "_blank", "noopener,noreferrer");
    if (!win) {
      global.alert("Permita pop-ups neste site para exportar em PDF (impressão).");
      return false;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(function () {
      try {
        win.print();
      } catch (e) {

      }
    }, 350);
    return true;
  }

  global.EcocoletaExport = {
    timestamp: timestamp,
    downloadReport: downloadReport,
    downloadExcel: downloadExcel,
    downloadCsv: downloadReport,
    printPdf: printPdf,
  };
})(typeof window !== "undefined" ? window : this);
