package uk.ac.susx.shl.micromacro.core;

import uk.ac.susx.shl.micromacro.api.QueryRep;
import uk.ac.susx.shl.micromacro.api.WorkspaceRep;
import uk.ac.susx.tag.method51.core.data.store2.query.DatumQuery;

import java.sql.SQLException;
import java.util.*;
import java.util.logging.Logger;
import java.util.stream.Collectors;

public class WorkspaceFactory {

    private static final Logger LOG = Logger.getLogger(WorkspaceFactory.class.getName());

    private final QueryFactory queryFactory;

    public WorkspaceFactory(QueryFactory queryFactory){

        this.queryFactory = queryFactory;
    }


    public Workspace workspace(Map rep) {

        Workspace workspace = new Workspace((String)rep.get("name"), (String)rep.get("id"));

        Map<String, Map> queries = (Map<String, Map>)rep.get("queries");

        for(Map.Entry<String, Map> entry : queries.entrySet()) {
            Map qrep = entry.getValue();

            List<Map> h = (List<Map>)qrep.get("history");

            LinkedList<? extends DatumQuery> history = h
                    .stream()
                    .map(queryFactory::query)
                    .collect(Collectors.toCollection(LinkedList::new));

            workspace.setQuery(entry.getKey(), new Query<>(history, (Map<String,Object>)qrep.get("metadata")));
        }

        return workspace;
    }


    public Map rep(Workspace workspace) {

//        WorkspaceRep rep = new WorkspaceRep();
        Map rep = new HashMap();

        rep.put("id", workspace.id());
        rep.put("name", workspace.name());

        Map queries = new HashMap<>();

        for(Map.Entry<String, Query> entry : workspace.queries().entrySet()) {

            Query query = entry.getValue();

            Map queryRep = new HashMap();

            LinkedList history = new LinkedList();

            for(Object version : query.history()) {
                history.add(queryFactory.rep((DatumQuery)version));
            }

            queryRep.put("history", history);
            queryRep.put("metadata", query.getMeta());

            queries.put(entry.getKey(), queryRep);

        }
        rep.put("queries", queries);

        return rep;
    }


}
