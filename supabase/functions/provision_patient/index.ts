// supabase/functions/provision_patient/index.ts
// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("PROJECT_URL")!;
    const serviceKey = Deno.env.get("SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("ANON_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // caregiver JWT (must be authenticated)
    const authHeader = req.headers.get("Authorization")!;
    const jwt = authHeader?.split("Bearer ").pop() ?? "";

    const caregiverClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${jwt}` } }
    });

    // Get the authenticated user
    const { data: { user: authUser }, error: authError } = await caregiverClient.auth.getUser();
    
    if (authError || !authUser) {
      return new Response(JSON.stringify({ error: "Authentication required." }), { status: 401 });
    }

    // Check if user is a caregiver by checking the caregivers table
    const { data: caregiver, error: cgError } = await caregiverClient
      .from("caregivers")
      .select("id")
      .eq("id", authUser.id)
      .maybeSingle();

    if (cgError || !caregiver) {
      return new Response(JSON.stringify({ error: "Only caregivers can create patients." }), { status: 403 });
    }

    const caregiverId = caregiver.id;

    const body = await req.json();
    const { email, password, display_name } = body as {
      email: string; password: string; display_name?: string;
    };

    if (!email || !password) {
      return new Response(JSON.stringify({ error: "email and password required" }), { status: 400 });
    }

    // 1) Create auth user for patient (confirmed so they can sign in immediately)
    const { data: createdUser, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: "patient", display_name: display_name ?? "" }
    });
    if (createErr || !createdUser.user) throw createErr ?? new Error("createUser failed");

    const patientId = createdUser.user.id;

    // 2) Insert caregiver/patient rows
    // ensure caregiver is in caregivers table (should already exist, but just in case)
    await admin.from("caregivers")
      .insert({ id: caregiverId })
      .onConflict("id")
      .ignore();

    // create patient row linked to caregiver
    const { error: patErr } = await admin.from("patients")
      .insert({ id: patientId, caregiver_id: caregiverId });
    if (patErr) throw patErr;

    // create empty details row (optional)
    await admin.from("patient_details")
      .insert({ patient_id: patientId })
      .onConflict("patient_id")
      .ignore();

    return new Response(JSON.stringify({ patient_id: patientId }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), { status: 500 });
  }
});
