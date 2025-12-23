-- Insert the General department for the common user
INSERT INTO public.departments (name, description)
VALUES ('General', 'Default department for general users')
ON CONFLICT DO NOTHING;