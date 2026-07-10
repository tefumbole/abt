const TEMPLATES_KEY = 'alpha_letter_templates';

const init = () => {
    if (!localStorage.getItem(TEMPLATES_KEY)) {
        // Sample Template
        localStorage.setItem(TEMPLATES_KEY, JSON.stringify([{
            id: 'tmpl-welcome',
            category_id: 'cat-general',
            name: 'Welcome Letter',
            subject: 'Welcome to Alpha Bridge',
            body: 'Dear {USER_NAME},\n\nWe are delighted to welcome you to Alpha Bridge.\n\nSincerely,\n{ADMIN_NAME}',
            placeholders: ['{USER_NAME}', '{ADMIN_NAME}'],
            created_at: new Date().toISOString()
        }]));
    }
};

const getTemplates = () => {
    init();
    return JSON.parse(localStorage.getItem(TEMPLATES_KEY));
};

const saveTemplates = (data) => localStorage.setItem(TEMPLATES_KEY, JSON.stringify(data));

export const extractPlaceholders = (text) => {
    const regex = /\{[A-Z0-9_]+\}/g;
    return [...new Set(text.match(regex) || [])];
};

export const getAllTemplates = async () => {
    return getTemplates();
};

export const createTemplate = async (data) => {
    const templates = getTemplates();
    const newTmpl = {
        id: `tmpl-${Date.now()}`,
        ...data,
        placeholders: extractPlaceholders(data.body),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };
    templates.push(newTmpl);
    saveTemplates(templates);
    return newTmpl;
};

export const updateTemplate = async (id, data) => {
    const templates = getTemplates();
    const index = templates.findIndex(t => t.id === id);
    if (index === -1) throw new Error("Template not found");
    
    templates[index] = {
        ...templates[index],
        ...data,
        placeholders: extractPlaceholders(data.body || templates[index].body),
        updated_at: new Date().toISOString()
    };
    saveTemplates(templates);
    return templates[index];
};

export const deleteTemplate = async (id) => {
    const templates = getTemplates().filter(t => t.id !== id);
    saveTemplates(templates);
    return true;
};

export const duplicateTemplate = async (id) => {
    const templates = getTemplates();
    const tmpl = templates.find(t => t.id === id);
    if (!tmpl) throw new Error("Template not found");
    
    const newTmpl = {
        ...tmpl,
        id: `tmpl-${Date.now()}`,
        name: `Copy of ${tmpl.name}`,
        created_at: new Date().toISOString()
    };
    templates.push(newTmpl);
    saveTemplates(templates);
    return newTmpl;
};

export const previewTemplate = (template, sampleData) => {
    let content = template.body;
    Object.keys(sampleData).forEach(key => {
        content = content.replace(new RegExp(`{${key}}`, 'g'), sampleData[key] || '');
    });
    return content;
};