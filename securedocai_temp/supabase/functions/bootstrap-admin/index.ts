import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Check if admin already exists
    const { data: existingAdmins } = await supabase
      .from('user_roles')
      .select('id')
      .eq('role', 'admin')
      .limit(1);

    if (existingAdmins && existingAdmins.length > 0) {
      return new Response(
        JSON.stringify({ error: 'Bootstrap already completed. Admin user exists.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the General department
    const { data: generalDept } = await supabase
      .from('departments')
      .select('id')
      .eq('name', 'General')
      .single();

    if (!generalDept) {
      return new Response(
        JSON.stringify({ error: 'General department not found. Run migrations first.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const results: { user: string; status: string; error?: string }[] = [];

    // Create admin user
    const { data: adminUser, error: adminError } = await supabase.auth.admin.createUser({
      email: 'admin@abc.in',
      password: 'admin123',
      email_confirm: true,
      user_metadata: { full_name: 'Admin User' }
    });

    if (adminError) {
      results.push({ user: 'admin@abc.in', status: 'failed', error: adminError.message });
    } else if (adminUser.user) {
      // Add admin role
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({ user_id: adminUser.user.id, role: 'admin' });
      
      if (roleError) {
        results.push({ user: 'admin@abc.in', status: 'partial', error: `User created but role failed: ${roleError.message}` });
      } else {
        results.push({ user: 'admin@abc.in', status: 'success' });
      }
    }

    // Create common user
    const { data: commonUser, error: commonError } = await supabase.auth.admin.createUser({
      email: 'common@abc.in',
      password: 'common123',
      email_confirm: true,
      user_metadata: { full_name: 'Common User' }
    });

    if (commonError) {
      results.push({ user: 'common@abc.in', status: 'failed', error: commonError.message });
    } else if (commonUser.user) {
      // Add member role
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({ user_id: commonUser.user.id, role: 'member' });
      
      // Update profile with department
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ department_id: generalDept.id })
        .eq('id', commonUser.user.id);

      if (roleError || profileError) {
        results.push({ 
          user: 'common@abc.in', 
          status: 'partial', 
          error: `User created but: ${roleError?.message || ''} ${profileError?.message || ''}` 
        });
      } else {
        results.push({ user: 'common@abc.in', status: 'success' });
      }
    }

    console.log('Bootstrap completed:', results);

    return new Response(
      JSON.stringify({ message: 'Bootstrap completed', results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Bootstrap error:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
