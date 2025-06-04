type TransitionalCareReportProps = {
  report: {
    patient: {
      name: string;
      mrn: string;
      dob: string;
      admitted_date: string;
    };
    date_of_report: string;
    sections: {
      algorithm: string;
      tasks_completed: {
        task_name: string;
        completed_at: string;
        contact_info:string;
      }[];
    }[];
  } | null;
};

const TransitionalCareReport = ({ report }: TransitionalCareReportProps) => {
  if (!report) return null;

  const { patient, date_of_report, sections } = report;

  return (
    <div className="bg-white rounded-xl shadow p-6 mt-6">
        <h2 className="text-2xl font-semibold mb-4 text-center  no-print">Transitional Care Report</h2>

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
            <h3 className="text-lg font-semibold mb-2">
              {section.algorithm}
            </h3>
                
                <div className="hidden md:block overflow-x-auto">
      <table className="w-full border-collapse text-sm min-w-[600px]">
        <thead>
          <tr className="bg-prussian-blue text-white">
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
              <td className="p-3">{task.contact_info || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    {/* MOBILE CARD VIEW */}
    <div className="md:hidden space-y-4  no-print">
      {section.tasks_completed.map((task, i) => (
        <div key={i} className="border rounded-lg p-4 shadow-sm bg-gray-50">
          <p className="font-semibold mb-1">{task.task_name}</p>
          <p className="text-sm"><strong>Completed Date:</strong> {task.completed_at || 'N/A'}</p>
          <p className="text-sm"><strong>Contact Info:</strong> {task.contact_info || '—'}</p>
        </div>
      ))}
</div>

          </div>
        ))
      ) : (
        <p className="text-gray-500 italic">No tasks recorded for this patient.</p>
      )}
    </div>
  );
};

export default TransitionalCareReport;
