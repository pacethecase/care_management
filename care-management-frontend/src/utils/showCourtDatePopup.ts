// utils/showCourtDatePopup.ts
export const showCourtDatePopup = (): Promise<string | null> => {
  return new Promise((resolve) => {
    const container = document.createElement("div");
    container.className = "court-popup";

    const label = document.createElement("label");
    label.textContent = "📅 Select court date & time";

    const input = document.createElement("input");
    input.type = "datetime-local";

    const buttonGroup = document.createElement("div");
    buttonGroup.className = "court-popup-buttons";

    const submitBtn = document.createElement("button");
    submitBtn.textContent = "Submit";
    submitBtn.className = "court-popup-submit";

    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Cancel";
    cancelBtn.className = "court-popup-cancel";

    cancelBtn.onclick = () => {
      document.body.removeChild(container);
      resolve(null);
    };

    submitBtn.onclick = () => {
      const courtDate = input.value;
      document.body.removeChild(container);
      resolve(courtDate || null);
    };

    buttonGroup.appendChild(submitBtn);
    buttonGroup.appendChild(cancelBtn);
    container.appendChild(label);
    container.appendChild(input);
    container.appendChild(buttonGroup);
    document.body.appendChild(container);
  });
};
