import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import { seedTemplates } from "../data/templates";
import type { TemplateItem } from "../data/templates";

export const TEMPLATE_STORAGE_KEY = "agentic-templates-v1";

export interface TemplatesState {
  items: TemplateItem[];
}

// Initial state is hydrated here (not in a render effect) so the first paint
// already shows stored templates, and seeds are only used on first run.
// Stored data always wins — we never overwrite it with seeds.
function loadInitialItems(): TemplateItem[] {
  try {
    if (typeof window === "undefined" || !window.localStorage) return seedTemplates;
    const raw = window.localStorage.getItem(TEMPLATE_STORAGE_KEY);
    if (!raw) return seedTemplates;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return seedTemplates;
    const valid = parsed.filter(
      (t): t is TemplateItem =>
        typeof t === "object" &&
        t !== null &&
        typeof (t as TemplateItem).id === "string" &&
        typeof (t as TemplateItem).title === "string" &&
        typeof (t as TemplateItem).content === "string" &&
        typeof (t as TemplateItem).category === "string"
    );
    const existingIds = new Set(valid.map((item) => item.id));
    const missingSeeds = seedTemplates.filter((seed) => !existingIds.has(seed.id));
    return [...valid, ...missingSeeds];
  } catch {
    return seedTemplates;
  }
}

const initialState: TemplatesState = {
  items: loadInitialItems(),
};

function makeId(): string {
  return `u-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

const templatesSlice = createSlice({
  name: "templates",
  initialState,
  reducers: {
    setAll(state, action: PayloadAction<TemplateItem[]>) {
      state.items = action.payload;
    },
    addTemplate: {
      reducer(state, action: PayloadAction<TemplateItem>) {
        state.items.unshift(action.payload);
      },
      prepare(payload: { title: string; category: string; content: string }) {
        return { payload: { id: makeId(), ...payload } };
      },
    },
    updateTemplate(state, action: PayloadAction<TemplateItem>) {
      const index = state.items.findIndex((t) => t.id === action.payload.id);
      if (index !== -1) {
        state.items[index] = action.payload;
      }
    },
    deleteTemplate(state, action: PayloadAction<string>) {
      state.items = state.items.filter((t) => t.id !== action.payload);
    },
    resetTemplates(state, action: PayloadAction<TemplateItem[]>) {
      state.items = action.payload;
    },
  },
});

export const {
  setAll,
  addTemplate,
  updateTemplate,
  deleteTemplate,
  resetTemplates,
} = templatesSlice.actions;

export default templatesSlice.reducer;
