import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SavedPopup } from "./SavedPopup";

function Host() {
  const [open, setOpen] = useState(true);
  return open ? <SavedPopup title="হিসাব সেভ হয়েছে" detail="টাকা ঢুকেছে · নগদ · ৳৫০০" onClose={() => setOpen(false)} /> : <p>বন্ধ</p>;
}

describe("saved popup", () => {
  it("shows the success and closes on ঠিক আছে", () => {
    render(<Host />);
    expect(screen.getByRole("dialog", { name: "হিসাব সেভ হয়েছে" })).toBeInTheDocument();
    expect(screen.getByText("টাকা ঢুকেছে · নগদ · ৳৫০০")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "ঠিক আছে" }));
    expect(screen.getByText("বন্ধ")).toBeInTheDocument();
  });
});
