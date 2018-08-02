package uk.ac.susx.shl.micromacro.webapp.resources;

import com.google.gson.Gson;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import io.dropwizard.jersey.params.LocalDateParam;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import uk.ac.susx.shl.micromacro.core.data.text.SimpleDocument;
import uk.ac.susx.shl.micromacro.db.JdbiProvider;
import uk.ac.susx.tag.method51.core.data.PostgresUtils;
import uk.ac.susx.tag.method51.core.gson.GsonBuilderFactory;
import uk.ac.susx.tag.method51.core.meta.KeySet;

import javax.ws.rs.*;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/**
 * Created by sw206 on 18/07/2018.
 */
@Path("m52")
@Produces(MediaType.APPLICATION_JSON)
public class Method52Resouce {

    private final Jdbi jdbi;

    public Method52Resouce(Jdbi jdbi) {

        this.jdbi = jdbi;
    }


    @GET
    @Path("list-tables")
    public Response listTables() throws SQLException {

        try (Handle handle  = jdbi.open()) {
            Connection con = handle.getConnection();
            //no need to close - hadle does it
            List<String> dbs = PostgresUtils.getTableNames(con);
            return Response.status(Response.Status.OK).entity(
                    dbs
            ).build();
        }
    }

    @GET
    @Path("list-keys")
    public Response listKeys(@QueryParam("table") String table) throws SQLException {

        Gson gson = GsonBuilderFactory.get().create();

        try (Handle handle  = jdbi.open()) {
            Connection con = handle.getConnection();
            //no need to close - hadle does it
            JsonElement keysMeta = gson.fromJson(PostgresUtils.getComment(con, table), JsonObject.class).get("keys");

            KeySet keys = gson.fromJson(keysMeta, KeySet.class);

            return Response.status(Response.Status.OK).entity(
                    gson.toJson(keys)
            ).build();
        }
    }

    @POST
    @Path("get-scores")
    public Response getScores(@QueryParam("table") String table, @QueryParam("key") String key, @QueryParam("ids") List<String> ids) throws SQLException {

        Gson gson = GsonBuilderFactory.get().create();

        try (Handle handle  = jdbi.open()) {
            Connection con = handle.getConnection();
            //no need to close - hadle does it
            JsonElement keysMeta = gson.fromJson(PostgresUtils.getComment(con, table), JsonObject.class).get("keys");

            KeySet keys = gson.fromJson(keysMeta, KeySet.class);

            return Response.status(Response.Status.OK).entity(
                    gson.toJson(keys)
            ).build();
        }
    }

}