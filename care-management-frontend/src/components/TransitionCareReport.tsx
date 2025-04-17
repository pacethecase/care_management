import React from 'react';

const TransitionCareReport = ({ report }) => {
  if (!report) return null;

  const { patient, date_of_report, sections } = report;

  return (
    <div className="bg-white rounded-xl shadow p-6 mt-6">
        <h2 className="text-2xl font-semibold mb-4 text-center text-orange  no-print">Transition Care Report</h2>

      {/* Patient Info */}
      <div className="text-sm text-gray-700 mb-6 space-y-1">
        <p><strong>Patient:</strong> {patient.name}</p>
        <p><strong>MRN:</strong> {patient.mrn}</p>
        <p><strong>DOB:</strong> {patient.dob}</p>
        <p><strong>Admitted:</strong> {patient.admitted_date}</p>
        <p><strong>Report Date:</strong> {date_of_report}</p>
      </div>

      {/* Section Table per Algorithm */}
      {Array.isArray(sections) && sections.length > 0 ? (
        sections.map((section, idx) => (
          <div key={idx} className="mb-8">
            <h3 className="text-lg font-semibold mb-2 text-[var(--funky-orange)]">
              {section.algorithm}
            </h3>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-orange-500 text-white">
                  <th className="p-3 text-left">Task Name</th>
                  <th className="p-3 text-left">Completed Date</th>
                  <th className="p-3 text-left">Contact Info</th>
                </tr>
              </thead>
              <tbody>
                {section.tasks_completed.map((task, i) => (
                  <tr key={i} className="border-b">
                    <td className="p-3">{task.task_name}</td>
                    <td className="p-3">{task.completed_at || 'N/A'}</td>
                    <td className="p-3">
                      {section.contact_info || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      ) : (
        <p className="text-gray-500 italic">No tasks recorded for this patient.</p>
      )}
    </div>
  );
};

export default TransitionCareReport;
