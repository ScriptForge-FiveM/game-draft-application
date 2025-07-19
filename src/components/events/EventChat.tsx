@@ .. @@
   const [isUserRegistered, setIsUserRegistered] = useState(false)

   useEffect(() => {
     if (eventId && user) {
       checkUserRegistration()
       fetchMessages()
       subscribeToMessages()
     }
   }, [eventId, user])

@@ .. @@
   const checkUserRegistration = async () => {
     try {
       const { data, error } = await supabase
         .from('registrations')
         .select('id')
         .eq('event_id', eventId)
         .eq('user_id', user?.id)
          sender_username: profile?.username || user.email?.split('@')[0] || 'Utente',
         .single()

       if (error && error.code !== 'PGRST116') throw error
       setIsUserRegistered(!!data)
+      
+      // Also check if user is admin for this event
+      if (!data && profile?.is_admin) {
+        const { data: eventData } = await supabase
+          .from('draft_events')
+          .select('admin_id')
+          .eq('id', eventId)
+          .single()
+        
+        if (eventData?.admin_id === user?.id) {
+          setIsUserRegistered(true)
+        }
+      }
     } catch (error) {
       console.error('Error checking registration:', error)
     }
   }