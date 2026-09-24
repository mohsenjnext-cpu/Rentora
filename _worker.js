            });
          }
        }

        return errorResponse('Image not found', 404, env, undefined, origin);
      }
      if (method === 'POST' && path === '/api/sync/purge') {
        const { user } = await requireAdmin(request, env);
        await env.RENTORA_DB.batch([
          env.RENTORA_DB.prepare('DELETE FROM transactions'),
          env.RENTORA_DB.prepare('DELETE FROM payment_intents'),
          env.RENTORA_DB.prepare('DELETE FROM messages'),
          env.RENTORA_DB.prepare('DELETE FROM conversations'),
          env.RENTORA_DB.prepare('DELETE FROM reviews'),
          env.RENTORA_DB.prepare('DELETE FROM reports'),
          env.RENTORA_DB.prepare('DELETE FROM listing_contacts'),
          env.RENTORA_DB.prepare('DELETE FROM rentals'),
          env.RENTORA_DB.prepare('DELETE FROM listings')
        ]);
        await recordAdminAuditLog(env, user, 'DATABASE_PURGED', {
          purgedAt: now(),
          adminUid: user.pi_uid
        });
        return jsonResponse({ success: true, purged: true, by: user.pi_uid }, 200, env, origin);
      }
      if (path.startsWith('/api/')) return errorResponse('Route Not Found', 404, env, undefined, origin);
      if (env?.ASSETS && typeof env.ASSETS.fetch === 'function') {
        const assetResponse = await env.ASSETS.fetch(request);
        if (path === '/' || path === '/index.html') {
          const headers = new Headers(assetResponse.headers);
          headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
          headers.set('Pragma', 'no-cache');
          return new Response(assetResponse.body, { status: assetResponse.status, statusText: assetResponse.statusText, headers });
        }
        return assetResponse;
      }
      return errorResponse('Route Not Found', 404, env, undefined, origin);
    } catch (err) {
      console.error('Rentora worker error', err);
      const msg = String(err?.message || '');
      let status = Number(err?.status) || 500;
      let displayMessage = err?.message || 'Server error';
      if (msg.includes('already reserved') || msg.includes('overlap')) {
        status = 409;
        displayMessage = 'این کالا برای تاریخ‌های انتخابی در دسترس نیست یا قبلاً رزرو شده است.';
      } else if (msg.includes('UNIQUE constraint')) {
        status = 409;
        displayMessage = 'این درخواست قبلاً ثبت شده است.';
      }
      return errorResponse(displayMessage, status, env, undefined, origin);