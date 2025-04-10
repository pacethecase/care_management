import React from "react";

const AlgorithmSelection = ({ formData, setFormData }) => {
  const algorithms = [
    {
      key: "is_behavioral",
      label: "Behavioral",
      subOptions: [
        { key: "is_restrained", label: "Is Patient Restrained?" },
        { key: "is_behavioral_team", label: "Behavioral Intervention Team Needed?" },
        {
          key: "is_geriatric_psych_available",
          label: "Geriatric Psychiatry Available?",
        },
      ],
    },
    { key: "is_ltc", label: "LTC", subOptions: [] },
    { key: "is_guardianship", label: "Guardianship", subOptions: [] },
  ];

  const handleSelection = (event, key) => {
    event.preventDefault();
    setFormData((prev) => {
      const newValue = !prev[key];
      const updatedData = { ...prev, [key]: newValue };

      if (key === "is_behavioral" && !newValue) {
        updatedData.is_restrained = false;
        updatedData.is_behavioral_team = false;
        updatedData.is_geriatric_psych_available = false;
      }

      return updatedData;
    });
  };

  const handleSubOptionChange = (event) => {
    const { name, checked } = event.target;

    setFormData((prev) => {
      let updatedData = { ...prev, [name]: checked };

      // Disable and uncheck Geriatric Psychiatry if age is <= 65
      if (name === "is_geriatric_psych_available" && prev.age <= 65) {
        updatedData.is_geriatric_psych_available = false;
      }

      return updatedData;
    });
  };

  return (
    <div className="md:col-span-2">
      <p className="font-medium  text-gray-dark mb-3 text-lg">Patient Tags:</p>

      {/* Main Algorithm Tabs */}
      <div className="flex space-x-4 mb-6">
        {algorithms.map(({ key, label }) => (
          <button
            key={key}
            className={`tab px-6 py-2 rounded-lg font-semibold transition-all duration-300 focus:outline-none border ${
              formData[key]
                ? "border-hospital-blue shadow-md bg-blue-50 text-blue-700"
                : "border-transparent hover:bg-hospital-tab-hover hover:text-hospital-blue"
            }`}
            onClick={(e) => handleSelection(e, key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Behavioral Sub-options */}
      {formData.is_behavioral && (
        <div className="p-5 bg-gray-50 rounded-md shadow-sm border border-gray-300">
          <p className="font-semibold text-gray-700 mb-3">Behavioral Management Details:</p>

          <div className="flex flex-row space-y-2">
            {algorithms
              .find((alg) => alg.key === "is_behavioral")
              ?.subOptions.map(({ key, label }) => (
                <label key={key} className="flex items-center space-x-3 justify-start">
                  <input
                    type="checkbox"
                    id={key}
                    name={key}
                    checked={formData[key] || false}
                    onChange={handleSubOptionChange}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    disabled={key === "is_geriatric_psych_available" && formData.age <= 65}
                  />
                  <span
                    className={`text-gray-800 ${
                      key === "is_geriatric_psych_available" && formData.age <= 65
                        ? "text-gray-400" // Make text lighter if disabled
                        : ""
                    }`}
                  >
                    {label}
                  </span>
                </label>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AlgorithmSelection;
