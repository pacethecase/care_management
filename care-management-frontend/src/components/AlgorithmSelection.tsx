import React from "react";

interface AlgorithmSelectionProps<T extends { age: number }> {
  formData: T;
  setFormData: React.Dispatch<React.SetStateAction<T>>;
}

const AlgorithmSelection = <T extends { age: number }>({
  formData,
  setFormData,
}: AlgorithmSelectionProps<T>) => {
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
    {
      key: "is_ltc",
      label: "LTC",
      subOptions: [
        { key: "is_ltc_medical", label: "Medical Eligibility" },
        { key: "is_ltc_financial", label: "Financial Eligibility" },
      ],
    },
    {
      key: "is_guardianship",
      label: "Guardianship",
      subOptions: [
        { key: "is_guardianship_financial", label: "Financial Requirement" },
        { key: "is_guardianship_person", label: "Person Requirement" },
        { key: "is_guardianship_emergency", label: "Emergency Required" },
      ],
    },
  ];

  const handleSelection = (
    event: React.MouseEvent<HTMLButtonElement>,
    key: keyof T
  ) => {
    event.preventDefault();
    setFormData((prev) => {
      const newValue = !prev[key];
      const updatedData: Record<string, any> = { ...prev, [key]: newValue };

      if (!newValue) {
        const algo = algorithms.find((a) => a.key === key);
        algo?.subOptions.forEach(({ key: subKey }) => {
          updatedData[subKey] = false;
        });
      }

      return updatedData as T;
    });
  };

  const handleSubOptionChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = event.target;

    setFormData((prev) => {
      const updatedData: Record<string, any> = { ...prev, [name]: checked };

      if (name === "is_geriatric_psych_available" && prev.age <= 65) {
        updatedData[name] = false;
      }

      return updatedData as T;
    });
  };

  return (
    <div className="md:col-span-2">
      <p className="font-medium text-[var(--text-dark)] mb-3 text-lg">Patient Tags:</p>

      <div className="flex flex-wrap gap-3 mb-6">
        {algorithms.map(({ key, label }) => (
          <button
            key={key}
            className={`tab px-6 py-2 rounded-lg font-semibold transition-all duration-300 focus:outline-none border ${
              formData[key as keyof T]
                ? "border-[var(--funky-orange)] bg-[var(--hover-tab)] text-[var(--funky-orange)] shadow"
                : "border-transparent hover:bg-[var(--hover-tab)]"
            }`}
            onClick={(e) => handleSelection(e, key as keyof T)}
          >
            {label}
          </button>
        ))}
      </div>

      {algorithms.map(
        (alg) =>
          formData[alg.key as keyof T] && (
            <div
              key={alg.key}
              className="p-5 mb-5 bg-white rounded-md border border-[var(--border-muted)] shadow-sm"
            >
              <p className="font-semibold text-[var(--text-dark)] mb-3">
                {alg.label} Details:
              </p>

              <div className="flex flex-row gap-6 flex-wrap">
                {alg.subOptions.map(({ key, label }) => (
                  <label
                    key={key}
                    className="flex items-center gap-3 text-[var(--text-dark)]"
                  >
                    <input
                      type="checkbox"
                      name={key}
                      checked={!!formData[key as keyof T]}
                      onChange={handleSubOptionChange}
                      disabled={key === "is_geriatric_psych_available" && formData.age <= 65}
                      className="w-4 h-4 text-[var(--funky-orange)] border-gray-300 rounded"
                    />
                    <span
                      className={`${
                        key === "is_geriatric_psych_available" && formData.age <= 65
                          ? "text-gray-400"
                          : ""
                      }`}
                    >
                      {label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )
      )}
    </div>
  );
};

export default AlgorithmSelection;
